# FF Backend + Ticketing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend familyfrequencies.com with a Supabase-backed admin dashboard, Stripe Checkout ticketing, an event template page, legal pages, and n8n publish automation.

**Architecture:** Vanilla HTML/CSS/JS on Vercel. Vercel serverless functions (ES module `export default async function handler(req, res)`) handle all server-side logic. Supabase stores events and tickets with RLS. Stripe Checkout hosts the payment page — we never handle card data. Body parsing: Vercel auto-parses JSON and form bodies into `req.body` (confirmed pattern from existing `api/subscribe.js`).

**Tech Stack:** Supabase (PostgreSQL + Auth + RLS + RPC), Supabase JS v2 (CDN, browser, admin only), Stripe REST API (native fetch, no SDK), Vercel serverless functions (ES modules), vanilla HTML/CSS/JS, n8n on Railway (WF08 automation).

---

## Prerequisites — Complete First

**Tasks 1–9 from the existing admin plan must be completed before Task 10.**

Full task detail with all code is in:
`docs/superpowers/plans/2026-06-27-admin-backend.md`

That plan covers: Supabase project creation, `ff_events` table, `/api/events`, dynamic `events.html`, admin scaffold (`admin/index.html` + `admin/admin.css`), Supabase auth, events CRUD, Kit stats tab, and production deploy.

Keep note of the **Supabase project ID** from Task 1 — it's needed in Tasks 10–13.

---

## File Map

**Create (new files):**
- `api/events/[slug].js` — public single-event endpoint, strips Stripe IDs
- `api/checkout.js` — POST, creates Stripe Checkout session
- `api/stripe-webhook.js` — POST, handles `checkout.session.completed`
- `api/publish-event.js` — POST (admin-auth required), creates Stripe Product + Price, publishes event
- `event.html` — public event template page (renders any event from DB)
- `privacy.html` — Privacy Policy (NZ Privacy Act 2020)
- `terms.html` — Terms & Conditions
- `waiver.html` — Liability Waiver (physical events)

**Modify (existing files):**
- `vercel.json` — add security headers + `/event/:slug` rewrite
- `admin/index.html` — ticketing fields in event form, Attendees button per event, Attendees view
- `admin/admin.css` — capacity gauge, attendees table, ticketing form styles
- `admin/admin.js` — ticketing form toggle, publish action, attendees tab
- `confirmed.html` — update with post-purchase message and event details
- `css/site.css` — event template page styles

---

## Task 10: Extend Supabase schema for ticketing

**Files:** None (Supabase MCP only)

- [ ] **Step 1: Apply ticketing migration**

  Use `mcp__claude_ai_Supabase__apply_migration` with your project ID:

  ```sql
  -- Add ticketing columns to ff_events
  ALTER TABLE ff_events
    ADD COLUMN is_ticketed         boolean     NOT NULL DEFAULT false,
    ADD COLUMN capacity            integer,
    ADD COLUMN price_cents         integer,
    ADD COLUMN tickets_sold        integer     NOT NULL DEFAULT 0,
    ADD COLUMN ticket_sale_opens   timestamptz,
    ADD COLUMN stripe_product_id   text,
    ADD COLUMN stripe_price_id     text;

  -- Create ff_tickets table
  CREATE TABLE ff_tickets (
    id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id          uuid        NOT NULL REFERENCES ff_events(id),
    stripe_session_id text        UNIQUE NOT NULL,
    buyer_name        text        NOT NULL,
    buyer_email       text        NOT NULL,
    quantity          integer     NOT NULL DEFAULT 1,
    ticket_type       text        NOT NULL DEFAULT 'general',
    amount_paid_cents integer     NOT NULL,
    created_at        timestamptz DEFAULT now()
  );

  ALTER TABLE ff_tickets ENABLE ROW LEVEL SECURITY;

  -- Authenticated admins: read only
  CREATE POLICY "auth_read_tickets" ON ff_tickets
    FOR SELECT USING (auth.role() = 'authenticated');

  -- Atomic capacity check + ticket insert (called by webhook via service role)
  CREATE OR REPLACE FUNCTION record_ticket(
    p_event_id          uuid,
    p_session_id        text,
    p_buyer_name        text,
    p_buyer_email       text,
    p_quantity          integer,
    p_amount_paid_cents integer
  ) RETURNS void AS $$
  DECLARE
    v_capacity integer;
    v_sold     integer;
  BEGIN
    SELECT capacity INTO v_capacity FROM ff_events WHERE id = p_event_id FOR UPDATE;
    SELECT COALESCE(SUM(quantity), 0) INTO v_sold FROM ff_tickets WHERE event_id = p_event_id;
    IF v_capacity IS NOT NULL AND (v_sold + p_quantity) > v_capacity THEN
      RAISE EXCEPTION 'sold_out';
    END IF;
    INSERT INTO ff_tickets (
      event_id, stripe_session_id, buyer_name, buyer_email,
      quantity, amount_paid_cents
    ) VALUES (
      p_event_id, p_session_id, p_buyer_name, p_buyer_email,
      p_quantity, p_amount_paid_cents
    ) ON CONFLICT (stripe_session_id) DO NOTHING;
    UPDATE ff_events
      SET tickets_sold = tickets_sold + p_quantity,
          updated_at   = now()
      WHERE id = p_event_id;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;
  ```

- [ ] **Step 2: Verify**

  Use `mcp__claude_ai_Supabase__execute_sql`:
  ```sql
  SELECT column_name FROM information_schema.columns
    WHERE table_name = 'ff_events' AND column_name IN
      ('is_ticketed','capacity','price_cents','tickets_sold','stripe_price_id');
  SELECT table_name FROM information_schema.tables WHERE table_name = 'ff_tickets';
  SELECT routine_name FROM information_schema.routines WHERE routine_name = 'record_ticket';
  ```
  Expected: 5 column rows, 1 table row, 1 routine row.

- [ ] **Step 3: Add env vars**

  Append to `.env`:
  ```
  STRIPE_SECRET_KEY=sk_live_...
  STRIPE_WEBHOOK_SECRET=whsec_...
  SUPABASE_SERVICE_ROLE_KEY=eyJ...
  ```
  Add all three to Vercel: `vercel env add STRIPE_SECRET_KEY production` (repeat for each).

- [ ] **Step 4: Commit**
  ```bash
  git add docs/superpowers/plans/2026-06-30-backend-ticketing-plan.md
  git commit -m "docs: add backend + ticketing implementation plan"
  ```

---

## Task 11: Security headers + event URL rewrite (`vercel.json`)

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Replace `vercel.json`**

  Current content is `{ "cleanUrls": true }`. Replace entirely with:

  ```json
  {
    "cleanUrls": true,
    "rewrites": [
      { "source": "/event/:slug", "destination": "/event.html" }
    ],
    "headers": [
      {
        "source": "/(.*)",
        "headers": [
          { "key": "X-Frame-Options", "value": "DENY" },
          { "key": "X-Content-Type-Options", "value": "nosniff" },
          { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
          { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
          {
            "key": "Content-Security-Policy",
            "value": "default-src 'self'; script-src 'self' 'unsafe-inline' js.stripe.com cdn.jsdelivr.net fonts.googleapis.com va.vercel-scripts.com; style-src 'self' 'unsafe-inline' fonts.googleapis.com; font-src fonts.gstatic.com; img-src 'self' data: res.cloudinary.com assets.stripe.com; connect-src 'self' api.stripe.com *.supabase.co api.kit.com; frame-src checkout.stripe.com"
          }
        ]
      }
    ]
  }
  ```

  The `/event/:slug` rewrite means `/event/first-aid-course` serves `event.html` — the page reads `window.location.pathname` to get the slug.

- [ ] **Step 2: Verify locally**

  ```bash
  vercel dev
  curl -I http://localhost:3000/
  ```
  Expected output includes `x-frame-options: DENY` and `x-content-type-options: nosniff`.

- [ ] **Step 3: Commit**
  ```bash
  git add vercel.json
  git commit -m "chore: add security headers and event URL rewrite to vercel.json"
  ```

---

## Task 12: Public single-event API endpoint

**Files:**
- Create: `api/events/[slug].js`

- [ ] **Step 1: Create the directory and file**

  ```bash
  mkdir -p api/events
  ```

  Create `api/events/[slug].js`:

  ```js
  export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).end();

    const { slug } = req.query;
    if (!slug || typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) {
      return res.status(400).json({ error: 'Invalid slug' });
    }

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;

    try {
      const r = await fetch(
        `${url}/rest/v1/ff_events?slug=eq.${encodeURIComponent(slug)}&select=*&limit=1`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } }
      );
      if (!r.ok) return res.status(502).json({ error: 'Database error' });

      const events = await r.json();
      if (!events.length) return res.status(404).json({ error: 'Event not found' });

      const event = events[0];
      // RLS already enforces this, but double-check
      if (!['published', 'past'].includes(event.status)) {
        return res.status(404).json({ error: 'Event not found' });
      }

      // Strip server-only fields before sending to public
      const { stripe_product_id, stripe_price_id, ...safeEvent } = event;

      res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
      return res.status(200).json(safeEvent);
    } catch (err) {
      console.error('Event slug fetch error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }
  ```

- [ ] **Step 2: Test locally**

  ```bash
  vercel dev
  # In a new terminal (replace 'daylight-disco' with the slug from your DB):
  curl http://localhost:3000/api/events/daylight-disco
  ```
  Expected: JSON object with event fields. Confirm `stripe_product_id` and `stripe_price_id` are NOT present in the response.

- [ ] **Step 3: Test 404**
  ```bash
  curl -w "\n%{http_code}" http://localhost:3000/api/events/does-not-exist
  ```
  Expected: `404`

- [ ] **Step 4: Commit**
  ```bash
  git add api/events/[slug].js
  git commit -m "feat: add public /api/events/[slug] endpoint"
  ```

---

## Task 13: Stripe checkout endpoint

**Files:**
- Create: `api/checkout.js`

- [ ] **Step 1: Create `api/checkout.js`**

  ```js
  export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const { event_id, quantity = 1 } = req.body || {};

    // Validate inputs
    if (!event_id || typeof event_id !== 'string') {
      return res.status(400).json({ error: 'event_id required' });
    }
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1 || qty > 10) {
      return res.status(400).json({ error: 'quantity must be between 1 and 10' });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    const stripeKey   = process.env.STRIPE_SECRET_KEY;

    if (!supabaseUrl || !supabaseKey || !stripeKey) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Fetch event — anon key + RLS only returns published events
    let event;
    try {
      const r = await fetch(
        `${supabaseUrl}/rest/v1/ff_events?id=eq.${encodeURIComponent(event_id)}&select=*&limit=1`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
      );
      const rows = await r.json();
      event = rows[0];
    } catch (err) {
      console.error('Checkout event fetch error:', err);
      return res.status(500).json({ error: 'Could not load event' });
    }

    if (!event)                    return res.status(404).json({ error: 'Event not found' });
    if (event.status !== 'published') return res.status(400).json({ error: 'Event not available' });
    if (!event.is_ticketed)        return res.status(400).json({ error: 'Event is not ticketed' });
    if (!event.stripe_price_id)    return res.status(400).json({ error: 'Tickets not yet configured' });

    // Ticket sale window check
    if (event.ticket_sale_opens && new Date(event.ticket_sale_opens) > new Date()) {
      return res.status(400).json({ error: 'Ticket sales are not open yet' });
    }

    // Capacity check (pre-flight — webhook does the atomic check)
    if (event.capacity !== null && (event.tickets_sold + qty) > event.capacity) {
      return res.status(400).json({ error: 'Not enough spots remaining' });
    }

    // Create Stripe Checkout session
    try {
      const origin = req.headers.origin || 'https://familyfrequencies.com';
      const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization:  `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          mode: 'payment',
          'line_items[0][price]':    event.stripe_price_id,
          'line_items[0][quantity]': String(qty),
          success_url: `${origin}/event/${event.slug}?success=1`,
          cancel_url:  `${origin}/event/${event.slug}`,
          customer_creation: 'always',
          'metadata[event_id]':  event.id,
          'metadata[event_slug]': event.slug,
          'metadata[quantity]':  String(qty),
          'payment_intent_data[metadata][event_id]': event.id,
        }).toString(),
      });

      if (!r.ok) {
        const body = await r.text();
        console.error('Stripe session create error:', r.status, body);
        return res.status(502).json({ error: 'Could not create checkout session' });
      }

      const session = await r.json();
      return res.status(200).json({ url: session.url });
    } catch (err) {
      console.error('Checkout error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }
  ```

- [ ] **Step 2: Test with a bad event_id**
  ```bash
  vercel dev
  curl -X POST http://localhost:3000/api/checkout \
    -H "Content-Type: application/json" \
    -d '{"event_id":"not-a-real-id"}'
  ```
  Expected: `404 {"error":"Event not found"}`

- [ ] **Step 3: Test quantity validation**
  ```bash
  curl -X POST http://localhost:3000/api/checkout \
    -H "Content-Type: application/json" \
    -d '{"event_id":"<real-ticketed-event-id>","quantity":99}'
  ```
  Expected: `400 {"error":"quantity must be between 1 and 10"}`

- [ ] **Step 4: Commit**
  ```bash
  git add api/checkout.js
  git commit -m "feat: add /api/checkout endpoint for Stripe Checkout sessions"
  ```

---

## Task 14: Stripe webhook handler

**Files:**
- Create: `api/stripe-webhook.js`

The webhook handler must receive the raw (unparsed) request body to verify Stripe's HMAC signature. Vercel's default body parsing is bypassed by reading the stream manually.

- [ ] **Step 1: Create `api/stripe-webhook.js`**

  ```js
  import crypto from 'crypto';

  async function getRawBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', chunk => chunks.push(Buffer.from(chunk)));
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
  }

  function verifyStripeSignature(rawBody, sigHeader, secret) {
    // sigHeader format: "t=1234567890,v1=abcdef...,v0=..."
    const parts = Object.fromEntries(
      sigHeader.split(',').map(p => {
        const idx = p.indexOf('=');
        return [p.slice(0, idx), p.slice(idx + 1)];
      })
    );
    const { t: timestamp, v1: signature } = parts;
    if (!timestamp || !signature) return false;

    // Reject events older than 5 minutes (replay attack prevention)
    if (Math.abs(Date.now() / 1000 - parseInt(timestamp, 10)) > 300) return false;

    const signedPayload = `${timestamp}.${rawBody}`;
    const expected = crypto
      .createHmac('sha256', secret)
      .update(signedPayload, 'utf8')
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expected, 'hex')
      );
    } catch {
      return false;
    }
  }

  export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const rawBody = await getRawBody(req);
    const sigHeader = req.headers['stripe-signature'];
    const secret    = process.env.STRIPE_WEBHOOK_SECRET;
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!sigHeader || !secret) {
      console.error('Missing stripe-signature header or STRIPE_WEBHOOK_SECRET');
      return res.status(400).json({ error: 'Invalid request' });
    }

    if (!verifyStripeSignature(rawBody.toString(), sigHeader, secret)) {
      console.error('Stripe webhook signature verification failed');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    let event;
    try {
      event = JSON.parse(rawBody.toString());
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
    }

    // Only handle successful payments
    if (event.type !== 'checkout.session.completed') {
      return res.status(200).end();
    }

    const session = event.data.object;

    // Verify payment actually succeeded
    if (session.payment_status !== 'paid') {
      return res.status(200).end();
    }

    const eventId   = session.metadata?.event_id;
    const quantity  = parseInt(session.metadata?.quantity || '1', 10);
    const buyerName = session.customer_details?.name  || 'Unknown';
    const buyerEmail = session.customer_details?.email || '';
    const amountPaid = session.amount_total || 0;

    if (!eventId) {
      console.error('No event_id in webhook metadata — session:', session.id);
      return res.status(200).end(); // Acknowledge to prevent Stripe retrying
    }

    // Call Supabase RPC: atomic capacity check + insert (handles retries via ON CONFLICT)
    try {
      const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/record_ticket`, {
        method: 'POST',
        headers: {
          apikey:         serviceKey,
          Authorization:  `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          p_event_id:          eventId,
          p_session_id:        session.id,
          p_buyer_name:        buyerName,
          p_buyer_email:       buyerEmail,
          p_quantity:          quantity,
          p_amount_paid_cents: amountPaid,
        }),
      });

      if (!rpcRes.ok) {
        const body = await rpcRes.text();
        if (body.includes('sold_out')) {
          // Edge case: payment succeeded but we're oversold
          // Log for manual refund — do not throw (prevents Stripe retry loop)
          console.error('SOLD OUT AFTER PAYMENT — manual refund needed. Session:', session.id, 'Event:', eventId);
        } else {
          console.error('record_ticket RPC error:', rpcRes.status, body);
          // Return 500 so Stripe retries (legitimate DB error)
          return res.status(500).end();
        }
      }
    } catch (err) {
      console.error('Webhook handler DB error:', err);
      return res.status(500).end(); // Stripe will retry
    }

    return res.status(200).end();
  }
  ```

- [ ] **Step 2: Register the webhook in Stripe Dashboard**

  Go to Stripe Dashboard → Developers → Webhooks → Add endpoint:
  - URL: `https://familyfrequencies.com/api/stripe-webhook`
  - Events to listen to: `checkout.session.completed`
  - Copy the signing secret → set as `STRIPE_WEBHOOK_SECRET` in Vercel env vars

- [ ] **Step 3: Test webhook locally with Stripe CLI**

  Install Stripe CLI (brew install stripe/stripe-cli/stripe on Mac), then:
  ```bash
  stripe login
  stripe listen --forward-to localhost:3000/api/stripe-webhook
  ```
  In a second terminal:
  ```bash
  stripe trigger checkout.session.completed
  ```
  Expected in Stripe CLI terminal: `[200] POST http://localhost:3000/api/stripe-webhook`
  Expected in vercel dev terminal: no errors logged.

- [ ] **Step 4: Commit**
  ```bash
  git add api/stripe-webhook.js
  git commit -m "feat: add Stripe webhook handler with signature verification"
  ```

---

## Task 15: Publish-event endpoint (creates Stripe Product + Price)

**Files:**
- Create: `api/publish-event.js`

Called by the admin UI when publishing a ticketed event. Verifies the admin's Supabase JWT, creates a Stripe Product + Price, writes IDs back to Supabase, sets status to published.

- [ ] **Step 1: Create `api/publish-event.js`**

  ```js
  export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const jwt = authHeader.slice(7);

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const stripeKey   = process.env.STRIPE_SECRET_KEY;

    // Verify admin JWT
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey:        serviceKey,
        Authorization: `Bearer ${jwt}`,
      },
    });
    if (!userRes.ok) return res.status(401).json({ error: 'Invalid session' });

    const { event_id } = req.body || {};
    if (!event_id) return res.status(400).json({ error: 'event_id required' });

    // Fetch the event using service role (can see drafts)
    const eventRes = await fetch(
      `${supabaseUrl}/rest/v1/ff_events?id=eq.${encodeURIComponent(event_id)}&select=*&limit=1`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    );
    const [event] = await eventRes.json();
    if (!event)             return res.status(404).json({ error: 'Event not found' });
    if (!event.is_ticketed) return res.status(400).json({ error: 'Event is not ticketed' });

    // If already has a price ID, just publish (skip Stripe creation)
    if (event.stripe_price_id) {
      await fetch(`${supabaseUrl}/rest/v1/ff_events?id=eq.${event_id}`, {
        method: 'PATCH',
        headers: {
          apikey: serviceKey, Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json', Prefer: 'return=minimal',
        },
        body: JSON.stringify({ status: 'published', updated_at: new Date().toISOString() }),
      });
      return res.status(200).json({ stripe_price_id: event.stripe_price_id });
    }

    if (!event.price_cents) return res.status(400).json({ error: 'price_cents required to publish ticketed event' });

    // Create Stripe Product
    const productRes = await fetch('https://api.stripe.com/v1/products', {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        name:                  event.title,
        description:           event.description || event.title,
        'metadata[event_id]':  event.id,
        'metadata[slug]':      event.slug,
      }).toString(),
    });
    if (!productRes.ok) {
      console.error('Stripe product error:', await productRes.text());
      return res.status(502).json({ error: 'Could not create Stripe product' });
    }
    const product = await productRes.json();

    // Create Stripe Price
    const priceRes = await fetch('https://api.stripe.com/v1/prices', {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        product:     product.id,
        unit_amount: String(event.price_cents),
        currency:    'nzd',
      }).toString(),
    });
    if (!priceRes.ok) {
      console.error('Stripe price error:', await priceRes.text());
      return res.status(502).json({ error: 'Could not create Stripe price' });
    }
    const price = await priceRes.json();

    // Update ff_events: set Stripe IDs + publish
    const updateRes = await fetch(`${supabaseUrl}/rest/v1/ff_events?id=eq.${event_id}`, {
      method: 'PATCH',
      headers: {
        apikey: serviceKey, Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json', Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        stripe_product_id: product.id,
        stripe_price_id:   price.id,
        status:            'published',
        updated_at:        new Date().toISOString(),
      }),
    });
    if (!updateRes.ok) {
      console.error('Event update error:', updateRes.status);
      return res.status(502).json({ error: 'Stripe product created but event update failed — check Supabase' });
    }

    return res.status(200).json({ stripe_product_id: product.id, stripe_price_id: price.id });
  }
  ```

- [ ] **Step 2: Test with a draft non-ticketed event**
  ```bash
  # Get your admin JWT first (sign in via admin UI, grab it from browser DevTools → Application → localStorage)
  curl -X POST http://localhost:3000/api/publish-event \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <your-jwt>" \
    -d '{"event_id":"<id-of-non-ticketed-draft-event>"}'
  ```
  Expected: `400 {"error":"Event is not ticketed"}`

- [ ] **Step 3: Commit**
  ```bash
  git add api/publish-event.js
  git commit -m "feat: add /api/publish-event — creates Stripe product + price on publish"
  ```

---

## Task 16: Admin UI — ticketing fields + publish action

**Files:**
- Modify: `admin/index.html`
- Modify: `admin/admin.css`
- Modify: `admin/admin.js`

- [ ] **Step 1: Add ticketing fields to event form in `admin/index.html`**

  Find the `<div class="form-actions">` inside `#event-form` and insert this block immediately before it:

  ```html
  <!-- Ticketing section -->
  <div class="form-divider">Ticketing</div>
  <label class="toggle-label">
    <input type="checkbox" name="is_ticketed" id="chk-is-ticketed">
    Ticketed event
  </label>
  <div id="ticketing-fields" hidden>
    <div class="form-row">
      <label>Price (NZD)
        <input type="number" name="price_nzd" min="0.50" step="0.01" placeholder="45.00">
      </label>
      <label>Capacity <small>(blank = unlimited)</small>
        <input type="number" name="capacity" min="1" step="1" placeholder="20">
      </label>
    </div>
    <label>Tickets open <small>(blank = open on publish)</small>
      <input type="datetime-local" name="ticket_sale_opens">
    </label>
    <p class="stripe-status" id="stripe-status"></p>
  </div>
  ```

  Also find the `<select name="status">` element and add a `id="status-select"` attribute to it:
  ```html
  <select name="status" id="status-select">
  ```

- [ ] **Step 2: Add Attendees button to event row template in `admin/admin.js`**

  In the `loadEvents` function, find the template literal that renders `.event-row` HTML. Add the Attendees button after the existing `.btn-edit`:

  ```js
  // Find this line in the map():
  '<button class="btn-edit" data-id="${ev.id}">Edit</button>'

  // Replace with:
  '<button class="btn-edit" data-id="' + ev.id + '">Edit</button>'
  + (ev.is_ticketed ? '<button class="btn-attendees" data-id="' + ev.id + '" data-title="' + ev.title + '">Attendees</button>' : '')
  ```

- [ ] **Step 3: Add ticketing logic to `admin/admin.js`**

  Add these functions and event listeners (append to the bottom of `admin/admin.js`, before `init()`):

  ```js
  // ── Ticketing form toggle ─────────────────────────

  document.getElementById('chk-is-ticketed').addEventListener('change', function () {
    document.getElementById('ticketing-fields').hidden = !this.checked;
    document.getElementById('status-select').disabled = this.checked;
    if (this.checked) {
      document.getElementById('status-select').value = 'draft';
    }
  });

  // ── Override form submit for ticketed + publish ───

  const originalFormSubmitHandler = document.getElementById('event-form').onsubmit;

  document.getElementById('event-form').addEventListener('submit', async function handleTicketedSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const isTicketed = form.is_ticketed.checked;
    const wantsPublish = !isTicketed && form.status.value === 'published';

    // Build payload (extend existing save logic)
    const priceNzd = parseFloat(form.price_nzd?.value);
    const capacity = form.capacity?.value ? parseInt(form.capacity.value, 10) : null;
    const ticketSaleOpens = form.ticket_sale_opens?.value
      ? new Date(form.ticket_sale_opens.value).toISOString()
      : null;

    const extraPayload = {
      is_ticketed:       isTicketed,
      capacity:          capacity,
      price_cents:       isTicketed && !isNaN(priceNzd) ? Math.round(priceNzd * 100) : null,
      ticket_sale_opens: isTicketed ? ticketSaleOpens : null,
    };

    // Save event to Supabase first (using existing CRUD logic)
    const errEl = document.getElementById('form-error');
    errEl.textContent = '';
    const saveBtn = document.getElementById('btn-save-event');
    saveBtn.textContent = 'Saving…';

    const basePayload = {
      title:       form.title.value.trim(),
      slug:        form.slug.value.trim(),
      event_date:  form.event_date.value,
      time_start:  form.time_start.value || null,
      time_end:    form.time_end.value || null,
      venue:       form.venue.value.trim(),
      description: form.description.value.trim() || null,
      image_url:   form.image_url.value.trim() || null,
      detail_url:  form.detail_url.value.trim() || null,
      chips:       form.chips.value ? form.chips.value.split(',').map(s => s.trim()).filter(Boolean) : [],
      status:      isTicketed ? 'draft' : form.status.value,
      updated_at:  new Date().toISOString(),
      ...extraPayload,
    };

    let saveError;
    if (currentEventId) {
      ({ error: saveError } = await sb.from('ff_events').update(basePayload).eq('id', currentEventId));
    } else {
      const { data, error } = await sb.from('ff_events').insert(basePayload).select('id').single();
      saveError = error;
      if (data) currentEventId = data.id;
    }

    if (saveError) {
      errEl.textContent = saveError.message;
      saveBtn.textContent = 'Save event';
      return;
    }

    // If ticketed — offer publish via server endpoint
    if (isTicketed && currentEventId) {
      saveBtn.textContent = 'Saved. Publish?';
      document.getElementById('stripe-status').textContent = 'Event saved as draft. Use "Publish" to go live and create Stripe product.';

      // Add a one-time publish button if not already present
      if (!document.getElementById('btn-publish-ticketed')) {
        const publishBtn = document.createElement('button');
        publishBtn.type = 'button';
        publishBtn.id = 'btn-publish-ticketed';
        publishBtn.className = 'btn-primary';
        publishBtn.textContent = 'Publish + Create Stripe product';
        publishBtn.addEventListener('click', publishTicketedEvent);
        document.querySelector('.form-actions').appendChild(publishBtn);
      }
    } else {
      saveBtn.textContent = 'Save event';
      document.getElementById('event-form-wrap').hidden = true;
      currentEventId = null;
      loadEvents();
    }
  }, { once: false });

  async function publishTicketedEvent() {
    const btn = document.getElementById('btn-publish-ticketed');
    const errEl = document.getElementById('form-error');
    const stripeStatus = document.getElementById('stripe-status');
    btn.textContent = 'Publishing…';
    btn.disabled = true;

    const { data: { session } } = await sb.auth.getSession();
    if (!session) { errEl.textContent = 'Not authenticated'; btn.disabled = false; return; }

    const res = await fetch('/api/publish-event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ event_id: currentEventId }),
    });

    if (!res.ok) {
      const { error } = await res.json();
      errEl.textContent = error || 'Failed to publish';
      btn.textContent = 'Retry publish';
      btn.disabled = false;
      return;
    }

    stripeStatus.textContent = '✓ Live — tickets open';
    btn.textContent = 'Published!';
    setTimeout(() => {
      document.getElementById('event-form-wrap').hidden = true;
      currentEventId = null;
      loadEvents();
    }, 1500);
  }
  ```

- [ ] **Step 4: Add attendees button wiring to `admin/admin.js`**

  In `loadEvents`, after the existing `.btn-edit` event listener loop, add:

  ```js
  listEl.querySelectorAll('.btn-attendees').forEach(btn => {
    btn.addEventListener('click', () => loadAttendees(btn.dataset.id, btn.dataset.title));
  });
  ```

- [ ] **Step 5: Add ticketing CSS to `admin/admin.css`**

  Append:

  ```css
  .form-divider {
    margin: 24px 0 16px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
    border-top: 2px solid var(--border);
    padding-top: 16px;
  }

  .toggle-label {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 15px;
    font-weight: 700;
    color: var(--body);
    text-transform: none;
    letter-spacing: 0;
    cursor: pointer;
    margin-bottom: 16px;
  }
  .toggle-label input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: var(--navy);
    cursor: pointer;
    display: inline;
    margin: 0;
  }

  .stripe-status {
    font-size: 13px;
    color: #166534;
    font-weight: 600;
    min-height: 20px;
    margin: 8px 0 0;
  }

  .btn-attendees {
    flex: none;
    padding: 6px 14px;
    border: 2px solid var(--gold);
    background: white;
    border-radius: 6px;
    font-family: inherit;
    font-size: 13px;
    font-weight: 700;
    color: var(--navy);
    cursor: pointer;
    transition: all 0.12s;
  }
  .btn-attendees:hover { background: var(--gold); }
  ```

- [ ] **Step 6: Test in browser**

  Open `http://localhost:3000/admin` → sign in → click "+ Add event" → toggle "Ticketed event" on.
  Verify: price/capacity/ticket_sale_opens fields appear, status dropdown disables.
  Save a test ticketed event → verify "Publish + Create Stripe product" button appears.
  (Don't click Publish yet — Stripe keys needed in Step 7.)

- [ ] **Step 7: Test full publish flow**

  Ensure `STRIPE_SECRET_KEY` is in `.env` and `vercel dev` is running with env loaded.
  Click "Publish + Create Stripe product" on the test ticketed event.
  Expected:
  - Button shows "Publishing…" then "Published!"
  - In Stripe Dashboard → Products: a new product matching the event title appears
  - In Supabase: `ff_events` row has `stripe_product_id`, `stripe_price_id` populated, `status = 'published'`

- [ ] **Step 8: Commit**
  ```bash
  git add admin/index.html admin/admin.css admin/admin.js
  git commit -m "feat: add ticketing fields and publish action to admin event form"
  ```

---

## Task 17: Admin attendees tab

**Files:**
- Modify: `admin/index.html`
- Modify: `admin/admin.css`
- Modify: `admin/admin.js`

- [ ] **Step 1: Add attendees view HTML to `admin/index.html`**

  Inside `#tab-events`, after `#event-form-wrap`, add:

  ```html
  <!-- Attendees view -->
  <div id="attendees-wrap" hidden>
    <div class="attendees-header">
      <button id="btn-attendees-back" class="btn-secondary">← Back to events</button>
      <h3 id="attendees-title">Attendees</h3>
    </div>
    <div id="capacity-gauge-wrap" class="capacity-gauge-wrap"></div>
    <div id="attendees-list"></div>
    <div class="attendees-actions">
      <button id="btn-export-csv" class="btn-secondary">Export CSV</button>
    </div>
  </div>
  ```

- [ ] **Step 2: Add attendees functions to `admin/admin.js`**

  Append before `init()`:

  ```js
  // ── Attendees tab ────────────────────────────────

  let currentAttendeeEventId = null;
  let currentAttendees = [];

  async function loadAttendees(eventId, eventTitle) {
    currentAttendeeEventId = eventId;
    document.getElementById('attendees-title').textContent = eventTitle + ' — Attendees';
    document.getElementById('event-form-wrap').hidden = true;
    document.getElementById('attendees-wrap').hidden = false;
    document.getElementById('attendees-list').innerHTML = '<p class="no-data">Loading…</p>';
    document.getElementById('capacity-gauge-wrap').innerHTML = '';

    // Fetch event for capacity info
    const { data: events } = await sb.from('ff_events')
      .select('capacity, tickets_sold')
      .eq('id', eventId)
      .limit(1);
    const ev = events?.[0];

    if (ev?.capacity) {
      const pct = Math.round((ev.tickets_sold / ev.capacity) * 100);
      const remaining = ev.capacity - ev.tickets_sold;
      document.getElementById('capacity-gauge-wrap').innerHTML = `
        <div class="capacity-gauge">
          <div class="capacity-gauge__bar">
            <div class="capacity-gauge__fill" style="width:${pct}%"></div>
          </div>
          <p class="capacity-gauge__label">
            <strong>${ev.tickets_sold} / ${ev.capacity}</strong> spots filled
            &nbsp;·&nbsp; ${remaining} remaining
          </p>
        </div>`;
    }

    // Fetch tickets
    const { data: tickets, error } = await sb
      .from('ff_tickets')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at');

    if (error) {
      document.getElementById('attendees-list').innerHTML = '<p class="no-data">Failed to load attendees.</p>';
      return;
    }

    currentAttendees = tickets || [];

    if (!tickets.length) {
      document.getElementById('attendees-list').innerHTML = '<p class="no-data">No tickets sold yet.</p>';
      return;
    }

    document.getElementById('attendees-list').innerHTML = `
      <table class="attendees-table">
        <thead>
          <tr>
            <th>Name</th><th>Email</th><th>Qty</th>
            <th>Type</th><th>Paid (NZD)</th><th>Purchased</th>
          </tr>
        </thead>
        <tbody>
          ${tickets.map(t => `
            <tr>
              <td>${t.buyer_name}</td>
              <td><a href="mailto:${t.buyer_email}">${t.buyer_email}</a></td>
              <td>${t.quantity}</td>
              <td>${t.ticket_type}</td>
              <td>$${(t.amount_paid_cents / 100).toFixed(2)}</td>
              <td>${new Date(t.created_at).toLocaleString('en-NZ', { dateStyle: 'short', timeStyle: 'short' })}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  }

  document.getElementById('btn-attendees-back').addEventListener('click', () => {
    document.getElementById('attendees-wrap').hidden = true;
    currentAttendeeEventId = null;
    currentAttendees = [];
  });

  document.getElementById('btn-export-csv').addEventListener('click', () => {
    if (!currentAttendees.length) return;
    const headers = ['Name', 'Email', 'Quantity', 'Type', 'Paid (NZD cents)', 'Purchased'];
    const rows = currentAttendees.map(t => [
      t.buyer_name, t.buyer_email, t.quantity, t.ticket_type,
      t.amount_paid_cents, t.created_at,
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `attendees-${currentAttendeeEventId}.csv`;
    a.click();
  });
  ```

- [ ] **Step 3: Add attendees CSS to `admin/admin.css`**

  Append:

  ```css
  .attendees-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 20px;
  }
  .attendees-header h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 900;
    color: var(--navy);
    text-transform: uppercase;
  }

  .capacity-gauge-wrap { margin-bottom: 20px; }
  .capacity-gauge__bar {
    height: 12px;
    background: var(--border);
    border-radius: 6px;
    overflow: hidden;
    margin-bottom: 6px;
  }
  .capacity-gauge__fill {
    height: 100%;
    background: var(--navy);
    border-radius: 6px;
    transition: width 0.3s;
  }
  .capacity-gauge__label { font-size: 14px; color: var(--muted); margin: 0; }

  .attendees-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
    background: white;
    border-radius: var(--radius);
    overflow: hidden;
    border: 2px solid var(--border);
  }
  .attendees-table th {
    text-align: left;
    padding: 10px 14px;
    background: #f7f8fa;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
    border-bottom: 2px solid var(--border);
  }
  .attendees-table td {
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    color: var(--body);
  }
  .attendees-table tr:last-child td { border-bottom: none; }
  .attendees-table a { color: var(--navy); text-decoration: none; font-weight: 600; }
  .attendees-table a:hover { text-decoration: underline; }

  .attendees-actions { margin-top: 16px; }
  ```

- [ ] **Step 4: Test in browser**

  Sign in → open an event with tickets → click "Attendees".
  Verify: back button works, capacity gauge shows if capacity is set, "No tickets sold yet" shows for empty events.
  After a test purchase (Task 22), verify the buyer appears in the table.

- [ ] **Step 5: Commit**
  ```bash
  git add admin/index.html admin/admin.css admin/admin.js
  git commit -m "feat: add attendees tab to admin with capacity gauge and CSV export"
  ```

---

## Task 18: Public event template page (`/event.html`)

**Files:**
- Create: `event.html`
- Modify: `css/site.css`

The page reads its slug from `window.location.pathname` (e.g. `/event/first-aid-course` → slug = `first-aid-course`) thanks to the vercel.json rewrite from Task 11.

- [ ] **Step 1: Create `event.html`**

  ```html
  <!doctype html>
  <html lang="en-NZ">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Event | Family Frequencies</title>
    <meta name="description" content="Family Frequencies event">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="/css/site.css">
    <script src="/js/site.js" defer></script>
  </head>
  <body>
    <header class="site-header">
      <div class="container site-header__inner">
        <a class="brand-lockup" href="/" aria-label="Family Frequencies home">
          <svg class="brand-lockup__mark" viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="24" cy="13.5" r="6.5" fill="#F0B840"/><path d="M3 33 C7 25 12 25 16 33 C20 41 28 41 32 33 C36 25 41 25 45 33" stroke="#FAF0E0" stroke-width="4" stroke-linecap="round"/></svg>
          <span class="brand-lockup__words"><span>Family</span><span>Frequencies</span></span>
        </a>
        <a class="pill-button" href="/events">See all events</a>
      </div>
    </header>

    <main id="event-main">
      <div id="event-loading" class="event-loading">
        <div class="container"><p>Loading event…</p></div>
      </div>
      <div id="event-content" hidden></div>
      <div id="event-error" class="event-error" hidden>
        <div class="container">
          <p>Event not found. <a href="/events">See all events →</a></p>
        </div>
      </div>
    </main>

    <footer class="site-footer">
      <div class="container site-footer__inner">
        <p>© 2026 Family Frequencies</p>
        <nav class="footer-legal">
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms & Conditions</a>
          <a href="/waiver">Liability Waiver</a>
        </nav>
      </div>
    </footer>

    <script>
    (function () {
      // Extract slug from URL path: /event/first-aid-course → 'first-aid-course'
      var slug = window.location.pathname.replace(/^\/event\//, '').replace(/\/$/, '');
      if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
        document.getElementById('event-loading').hidden = true;
        document.getElementById('event-error').hidden = false;
        return;
      }

      // Check for ?success=1 (post-purchase redirect)
      var success = new URLSearchParams(window.location.search).get('success') === '1';

      function formatDate(dateStr) {
        var p = dateStr.split('-').map(Number);
        return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString('en-NZ', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
      }

      function formatTime(t) {
        if (!t) return '';
        var parts = t.split(':');
        var h = parseInt(parts[0], 10), m = parseInt(parts[1], 10);
        var period = h >= 12 ? 'pm' : 'am';
        var hour = h > 12 ? h - 12 : (h === 0 ? 12 : h);
        return hour + (m ? ':' + String(m).padStart(2, '0') : '') + period;
      }

      function formatPrice(cents) {
        return '$' + (cents / 100).toFixed(2).replace(/\.00$/, '');
      }

      function renderTicketing(event) {
        if (!event.is_ticketed) {
          return '<div class="event-free"><span class="chip">Free entry</span><span class="chip">Just turn up</span></div>';
        }

        var now = new Date();
        var saleOpens = event.ticket_sale_opens ? new Date(event.ticket_sale_opens) : null;

        if (saleOpens && saleOpens > now) {
          return '<div class="event-ticket-soon"><p>Tickets open ' + saleOpens.toLocaleDateString('en-NZ', { day: 'numeric', month: 'long' }) + '</p></div>';
        }

        var remaining = event.capacity !== null ? event.capacity - event.tickets_sold : null;
        var soldOut = remaining !== null && remaining <= 0;

        if (soldOut) {
          return '<div class="event-ticket-wrap"><p class="event-sold-out">Sold out</p></div>';
        }

        var spotsHtml = remaining !== null
          ? '<p class="event-spots">' + remaining + ' spot' + (remaining === 1 ? '' : 's') + ' remaining</p>'
          : '';

        return '<div class="event-ticket-wrap">'
          + spotsHtml
          + '<button class="pill-button pill-button--gold" id="btn-get-tickets">'
          + 'Get tickets — ' + formatPrice(event.price_cents)
          + '</button>'
          + '</div>';
      }

      fetch('/api/events/' + slug)
        .then(function (r) {
          if (!r.ok) throw new Error(r.status);
          return r.json();
        })
        .then(function (event) {
          document.title = event.title + ' | Family Frequencies';

          var timeStr = event.time_start
            ? formatTime(event.time_start) + (event.time_end ? '–' + formatTime(event.time_end) : '')
            : '';

          var chipsHtml = (event.chips || []).map(function (c) {
            return '<span class="chip">' + c + '</span>';
          }).join('');

          var successBanner = success
            ? '<div class="event-success-banner">🎉 You\'re on the list! Check your email for confirmation.</div>'
            : '';

          document.getElementById('event-content').innerHTML = successBanner + `
            <section class="event-hero" style="${event.image_url ? 'background-image:url(' + event.image_url + ')' : ''}">
              <div class="event-hero__overlay"></div>
              <div class="container event-hero__inner">
                <p class="eyebrow">${event.event_date ? formatDate(event.event_date) : ''}</p>
                <h1>${event.title}</h1>
                <p class="event-meta">${timeStr ? timeStr + ' &nbsp;·&nbsp; ' : ''}${event.venue || ''}</p>
                ${chipsHtml ? '<div class="chip-row">' + chipsHtml + '</div>' : ''}
              </div>
            </section>
            <section class="section section--cream">
              <div class="container event-body">
                ${event.description ? '<div class="event-description"><p>' + event.description + '</p></div>' : ''}
                ${renderTicketing(event)}
              </div>
            </section>`;

          document.getElementById('event-loading').hidden = true;
          document.getElementById('event-content').hidden = false;

          // Wire up Get Tickets button
          var btn = document.getElementById('btn-get-tickets');
          if (btn) {
            btn.addEventListener('click', function () {
              btn.textContent = 'Loading…';
              btn.disabled = true;
              fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event_id: event.id, quantity: 1 }),
              })
              .then(function (r) { return r.json(); })
              .then(function (data) {
                if (data.url) {
                  window.location.href = data.url;
                } else {
                  btn.textContent = data.error || 'Something went wrong — try again';
                  btn.disabled = false;
                }
              })
              .catch(function () {
                btn.textContent = 'Something went wrong — try again';
                btn.disabled = false;
              });
            });
          }
        })
        .catch(function () {
          document.getElementById('event-loading').hidden = true;
          document.getElementById('event-error').hidden = false;
        });
    })();
    </script>
  </body>
  </html>
  ```

- [ ] **Step 2: Add event page CSS to `css/site.css`**

  Append:

  ```css
  /* ── Event template page ── */
  .event-hero {
    position: relative;
    background: var(--navy);
    background-size: cover;
    background-position: center;
    color: var(--cream);
    min-height: 320px;
    display: flex;
    align-items: flex-end;
    padding-block: 48px;
  }
  .event-hero__overlay {
    position: absolute; inset: 0;
    background: linear-gradient(to top, rgba(26,43,64,0.85) 40%, rgba(26,43,64,0.4) 100%);
  }
  .event-hero__inner { position: relative; }
  .event-hero h1 {
    margin: 8px 0 0;
    font-size: clamp(40px, 12vw, 72px);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: -0.02em;
    line-height: 0.9;
  }
  .event-meta {
    margin: 10px 0 0;
    font-size: 18px;
    font-weight: 600;
    color: rgba(250,240,224,0.8);
  }

  .event-body {
    padding-block: 40px;
    max-width: 640px;
  }
  .event-description p {
    font-size: 18px;
    line-height: 1.6;
    color: var(--navy);
    margin: 0 0 28px;
  }

  .event-free { display: flex; gap: 10px; flex-wrap: wrap; }

  .event-ticket-wrap { margin-top: 8px; }
  .event-spots {
    font-size: 15px;
    font-weight: 700;
    color: var(--navy);
    margin: 0 0 12px;
  }
  .event-sold-out {
    display: inline-block;
    padding: 10px 20px;
    background: #e5e7eb;
    color: #6b7280;
    border-radius: 999px;
    font-weight: 800;
    font-size: 15px;
  }

  .pill-button--gold {
    background: var(--gold);
    color: var(--navy);
    font-size: 17px;
    padding: 14px 28px;
  }
  .pill-button--gold:hover { background: #d9a430; }

  .event-success-banner {
    background: #dcfce7;
    color: #166534;
    padding: 16px 24px;
    font-weight: 700;
    font-size: 16px;
    border-bottom: 2px solid #bbf7d0;
  }

  .event-loading, .event-error { padding: 60px 0; color: var(--navy); }

  /* ── Site footer ── */
  .site-footer {
    background: var(--navy);
    color: rgba(250,240,224,0.6);
    padding-block: 24px;
    margin-top: 60px;
    font-size: 13px;
  }
  .site-footer__inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
  }
  .footer-legal { display: flex; gap: 16px; }
  .footer-legal a { color: rgba(250,240,224,0.6); text-decoration: none; }
  .footer-legal a:hover { color: var(--cream); }
  ```

- [ ] **Step 3: Test the event page**

  ```bash
  vercel dev
  ```
  Open `http://localhost:3000/event/daylight-disco`
  Expected: Event hero with title, date, venue; free entry chips; no ticket button.

  Open `http://localhost:3000/event/does-not-exist`
  Expected: "Event not found" message.

- [ ] **Step 4: Commit**
  ```bash
  git add event.html css/site.css
  git commit -m "feat: add public event template page at /event/[slug]"
  ```

---

## Task 19: Legal pages

**Files:**
- Create: `privacy.html`
- Create: `terms.html`
- Create: `waiver.html`

- [ ] **Step 1: Create `privacy.html`**

  ```html
  <!doctype html>
  <html lang="en-NZ">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Privacy Policy | Family Frequencies</title>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="/css/site.css">
  </head>
  <body>
    <header class="site-header">
      <div class="container site-header__inner">
        <a class="brand-lockup" href="/" aria-label="Family Frequencies home">
          <svg class="brand-lockup__mark" viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="24" cy="13.5" r="6.5" fill="#F0B840"/><path d="M3 33 C7 25 12 25 16 33 C20 41 28 41 32 33 C36 25 41 25 45 33" stroke="#FAF0E0" stroke-width="4" stroke-linecap="round"/></svg>
          <span class="brand-lockup__words"><span>Family</span><span>Frequencies</span></span>
        </a>
      </div>
    </header>
    <main class="section">
      <div class="container legal-doc">
        <h1>Privacy Policy</h1>
        <p class="legal-date">Last updated: 30 June 2026</p>

        <p>Family Frequencies ("we", "us") is committed to protecting your personal information in accordance with the New Zealand Privacy Act 2020.</p>

        <h2>What we collect</h2>
        <ul>
          <li><strong>Mailing list signups:</strong> Your email address, collected when you sign up to hear about upcoming events. Stored and managed by <a href="https://kit.com" target="_blank" rel="noopener">Kit</a>.</li>
          <li><strong>Ticket purchases:</strong> Your name, email address, and payment information, collected when you purchase a ticket. Payment is processed by <a href="https://stripe.com/nz/privacy" target="_blank" rel="noopener">Stripe</a> — we do not store card details. Your name and email are stored securely in our database.</li>
          <li><strong>Analytics:</strong> Anonymous page view data collected by <a href="https://vercel.com/docs/analytics/privacy-policy" target="_blank" rel="noopener">Vercel Analytics</a>. No cookies are set. No personal data is collected.</li>
        </ul>

        <h2>How we use your information</h2>
        <ul>
          <li>To send you information about upcoming Family Frequencies events (mailing list subscribers only — unsubscribe any time).</li>
          <li>To manage event attendance and provide confirmation of ticket purchases.</li>
          <li>To contact you about changes to an event you have purchased tickets for.</li>
        </ul>

        <h2>Who we share your information with</h2>
        <p>We share your information only with the third-party services listed above (Kit, Stripe, Vercel) to the extent necessary to operate our events and communications. We do not sell your personal information.</p>

        <h2>How long we keep your information</h2>
        <ul>
          <li>Mailing list: until you unsubscribe.</li>
          <li>Ticket purchase records: retained for 2 years for accounting and event management purposes, then deleted.</li>
        </ul>

        <h2>Your rights</h2>
        <p>Under the Privacy Act 2020, you have the right to access, correct, or request deletion of your personal information. To exercise these rights, contact us at <a href="mailto:hello@familyfrequencies.com">hello@familyfrequencies.com</a>.</p>

        <h2>Contact</h2>
        <p>Family Frequencies<br>Mt Maunganui, Bay of Plenty, New Zealand<br>
        <a href="mailto:hello@familyfrequencies.com">hello@familyfrequencies.com</a></p>
      </div>
    </main>
    <footer class="site-footer">
      <div class="container site-footer__inner">
        <p>© 2026 Family Frequencies</p>
        <nav class="footer-legal">
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms & Conditions</a>
          <a href="/waiver">Liability Waiver</a>
        </nav>
      </div>
    </footer>
  </body>
  </html>
  ```

- [ ] **Step 2: Create `terms.html`**

  ```html
  <!doctype html>
  <html lang="en-NZ">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Terms & Conditions | Family Frequencies</title>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="/css/site.css">
  </head>
  <body>
    <header class="site-header">
      <div class="container site-header__inner">
        <a class="brand-lockup" href="/" aria-label="Family Frequencies home">
          <svg class="brand-lockup__mark" viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="24" cy="13.5" r="6.5" fill="#F0B840"/><path d="M3 33 C7 25 12 25 16 33 C20 41 28 41 32 33 C36 25 41 25 45 33" stroke="#FAF0E0" stroke-width="4" stroke-linecap="round"/></svg>
          <span class="brand-lockup__words"><span>Family</span><span>Frequencies</span></span>
        </a>
      </div>
    </header>
    <main class="section">
      <div class="container legal-doc">
        <h1>Terms &amp; Conditions</h1>
        <p class="legal-date">Last updated: 30 June 2026</p>

        <p>By purchasing a ticket to a Family Frequencies event, you agree to these terms.</p>

        <h2>Tickets</h2>
        <ul>
          <li>Tickets are sold per person and are non-transferable unless stated otherwise.</li>
          <li>You may transfer your ticket to another person by emailing us at <a href="mailto:hello@familyfrequencies.com">hello@familyfrequencies.com</a> at least 24 hours before the event.</li>
          <li>A ticket confirmation will be sent to the email address provided at purchase.</li>
        </ul>

        <h2>Refunds and cancellations</h2>
        <ul>
          <li><strong>Event cancelled by us:</strong> Full refund within 5 business days, processed to your original payment method.</li>
          <li><strong>Event postponed:</strong> Your ticket remains valid for the new date. If you cannot attend the new date, contact us within 7 days of the postponement announcement for a full refund.</li>
          <li><strong>You cannot attend:</strong> We do not offer refunds if you are unable to attend. You may transfer your ticket to another person (see above).</li>
        </ul>

        <h2>Venue and entry</h2>
        <ul>
          <li>Family Frequencies events are all-ages unless stated on the specific event page.</li>
          <li>We reserve the right to refuse entry or remove any person whose behaviour is disruptive or unsafe.</li>
          <li>Venue-specific rules (alcohol, smoking, etc.) apply and will be communicated in advance where relevant.</li>
        </ul>

        <h2>Photography and video</h2>
        <p>Family Frequencies events are photographed and filmed for social media and promotional purposes. By attending, you consent to being photographed or filmed. If you do not wish to be included in any published content, please let us know at the event.</p>

        <h2>Children</h2>
        <p>Children must be accompanied by a responsible adult at all times. Family Frequencies events are designed to be child-friendly but parents and guardians are responsible for supervising their children.</p>

        <h2>Limitation of liability</h2>
        <p>To the extent permitted by law, Family Frequencies is not liable for any loss, injury, or damage sustained at an event unless caused by our gross negligence. Please also read our <a href="/waiver">Liability Waiver</a> for events involving physical activity.</p>

        <h2>Contact</h2>
        <p><a href="mailto:hello@familyfrequencies.com">hello@familyfrequencies.com</a></p>
      </div>
    </main>
    <footer class="site-footer">
      <div class="container site-footer__inner">
        <p>© 2026 Family Frequencies</p>
        <nav class="footer-legal">
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms & Conditions</a>
          <a href="/waiver">Liability Waiver</a>
        </nav>
      </div>
    </footer>
  </body>
  </html>
  ```

- [ ] **Step 3: Create `waiver.html`**

  ```html
  <!doctype html>
  <html lang="en-NZ">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Liability Waiver | Family Frequencies</title>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="/css/site.css">
  </head>
  <body>
    <header class="site-header">
      <div class="container site-header__inner">
        <a class="brand-lockup" href="/" aria-label="Family Frequencies home">
          <svg class="brand-lockup__mark" viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="24" cy="13.5" r="6.5" fill="#F0B840"/><path d="M3 33 C7 25 12 25 16 33 C20 41 28 41 32 33 C36 25 41 25 45 33" stroke="#FAF0E0" stroke-width="4" stroke-linecap="round"/></svg>
          <span class="brand-lockup__words"><span>Family</span><span>Frequencies</span></span>
        </a>
      </div>
    </header>
    <main class="section">
      <div class="container legal-doc">
        <h1>Liability Waiver</h1>
        <p class="legal-date">Applies to: First Aid Courses and all events involving physical activity. Last updated: 30 June 2026.</p>

        <div class="waiver-notice">
          <p><strong>Please read this carefully before purchasing a ticket to any Family Frequencies event that involves physical activity (including but not limited to first aid courses, workshops with practical exercises, and similar events).</strong></p>
          <p>By purchasing a ticket, you acknowledge and agree to the terms below.</p>
        </div>

        <h2>Nature of the activity</h2>
        <p>Certain Family Frequencies events involve physical activity including, but not limited to: CPR practice, bandaging, casualty handling, and other practical first aid exercises. These activities carry an inherent risk of minor injury, including muscle soreness, bruising, or discomfort.</p>

        <h2>Participant fitness</h2>
        <p>By purchasing a ticket to an event involving physical activity, you confirm that:</p>
        <ul>
          <li>You are physically capable of participating in the activities described for the event.</li>
          <li>You do not have any medical condition that would prevent safe participation.</li>
          <li>If you have any medical conditions, injuries, or concerns, you have consulted a medical professional before registering.</li>
          <li>You will inform the event facilitator of any medical conditions or physical limitations relevant to participation.</li>
        </ul>

        <h2>Assumption of risk</h2>
        <p>You acknowledge that participation in physical activity carries inherent risks. You voluntarily assume all risks associated with participation, including risk of physical injury.</p>

        <h2>Release of liability</h2>
        <p>To the fullest extent permitted by New Zealand law, you release Family Frequencies, its organisers, volunteers, venue owners, and facilitators from any claim, liability, cost, or expense arising from injury or loss suffered during participation in the event, except where such injury or loss is caused by our gross negligence or wilful misconduct.</p>

        <h2>Minors</h2>
        <p>If you are purchasing a ticket on behalf of a minor, you confirm that you are the parent or legal guardian of that minor, and you agree to these terms on their behalf.</p>

        <h2>Questions</h2>
        <p>If you have any questions about this waiver, contact us before purchasing: <a href="mailto:hello@familyfrequencies.com">hello@familyfrequencies.com</a></p>

        <p class="legal-note"><em>This waiver is intended as a reasonable risk management document for community events. It does not limit your rights under the New Zealand Consumer Guarantees Act 1993 or the Fair Trading Act 1986.</em></p>
      </div>
    </main>
    <footer class="site-footer">
      <div class="container site-footer__inner">
        <p>© 2026 Family Frequencies</p>
        <nav class="footer-legal">
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms & Conditions</a>
          <a href="/waiver">Liability Waiver</a>
        </nav>
      </div>
    </footer>
  </body>
  </html>
  ```

- [ ] **Step 4: Add legal page CSS to `css/site.css`**

  Append:

  ```css
  /* ── Legal pages ── */
  .legal-doc {
    max-width: 720px;
    padding-block: 48px 80px;
  }
  .legal-doc h1 {
    font-size: clamp(36px, 8vw, 56px);
    font-weight: 900;
    text-transform: uppercase;
    color: var(--navy);
    letter-spacing: -0.02em;
    margin: 0 0 8px;
  }
  .legal-date {
    color: #6b7a8d;
    font-size: 14px;
    margin: 0 0 36px;
  }
  .legal-doc h2 {
    font-size: 20px;
    font-weight: 800;
    color: var(--navy);
    text-transform: uppercase;
    letter-spacing: 0.02em;
    margin: 36px 0 12px;
  }
  .legal-doc p, .legal-doc li {
    font-size: 16px;
    line-height: 1.7;
    color: #2d3b4e;
  }
  .legal-doc ul { padding-left: 20px; margin: 0 0 16px; }
  .legal-doc li { margin-bottom: 8px; }
  .legal-doc a { color: var(--navy); font-weight: 700; }

  .waiver-notice {
    background: #fef9c3;
    border-left: 4px solid var(--gold);
    padding: 16px 20px;
    border-radius: 0 8px 8px 0;
    margin-bottom: 28px;
  }
  .waiver-notice p { margin: 0 0 8px; }
  .waiver-notice p:last-child { margin: 0; }
  .legal-note { color: #6b7a8d; font-size: 14px; font-style: italic; margin-top: 40px; }
  ```

- [ ] **Step 5: Add footer links to `index.html`, `events.html`, `daylight-disco.html`, `confirmed.html`**

  Each page needs a footer if it doesn't have one. Add before `</body>` on each page:

  ```html
  <footer class="site-footer">
    <div class="container site-footer__inner">
      <p>© 2026 Family Frequencies</p>
      <nav class="footer-legal">
        <a href="/privacy">Privacy Policy</a>
        <a href="/terms">Terms & Conditions</a>
        <a href="/waiver">Liability Waiver</a>
      </nav>
    </div>
  </footer>
  ```

- [ ] **Step 6: Test all three pages**
  ```bash
  open http://localhost:3000/privacy
  open http://localhost:3000/terms
  open http://localhost:3000/waiver
  ```
  Verify each page loads, footer links work on all pages.

- [ ] **Step 7: Commit**
  ```bash
  git add privacy.html terms.html waiver.html css/site.css index.html events.html daylight-disco.html confirmed.html
  git commit -m "feat: add privacy policy, terms, and liability waiver pages with footer links"
  ```

---

## Task 20: n8n WF08 — Event Published Automation

**Files:** n8n workflow (configured in n8n UI on Railway)

This workflow fires when a Family Frequencies event is published. It queues an Instagram post draft, sends a Kit email broadcast, and pings the FF Telegram group.

- [ ] **Step 1: Set up Supabase webhook to n8n**

  In Supabase Dashboard → Database → Webhooks → Create webhook:
  - Name: `event_published`
  - Table: `ff_events`
  - Events: `UPDATE`
  - URL: `https://<your-railway-n8n-url>/webhook/ff-event-published`
  - HTTP method: POST
  - Headers: `{ "x-ff-webhook-secret": "<choose-a-random-string>" }`

  Note the webhook secret — you'll validate it in n8n.

- [ ] **Step 2: Create WF08 in n8n on Railway**

  Open your Railway n8n instance → New Workflow → name it "WF08 — FF Event Published".

  **Node 1 — Webhook trigger:**
  - Node: Webhook
  - HTTP Method: POST
  - Path: `ff-event-published`
  - Authentication: Header Auth → name: `x-ff-webhook-secret`, value: your secret from Step 1

  **Node 2 — Filter (only fire on status → published):**
  - Node: IF
  - Condition: `{{ $json.body.record.status }}` equals `published`
  - AND: `{{ $json.body.old_record.status }}` not equals `published`

  **Node 3 — Fetch full event (parallel branch A: Instagram draft):**
  - Node: HTTP Request
  - Method: GET
  - URL: `https://familyfrequencies.com/api/events/{{ $json.body.record.slug }}`

  **Node 4A — Insert Instagram draft to Google Sheet:**
  - Node: Google Sheets (existing credential from WF01)
  - Operation: Append Row
  - Sheet: same social scheduler sheet
  - Values:
    - `post_id`: `event-{{ $json.body.record.id }}`
    - `type`: `feed`
    - `caption`: `New event just dropped 🎉 {{ $node["Node 3"].json.title }} — {{ $node["Node 3"].json.event_date }} at {{ $node["Node 3"].json.venue }}. Link in bio.`
    - `image_url`: `{{ $node["Node 3"].json.image_url }}`
    - `status`: `draft`
    - `scheduled_at`: (leave blank — calendar UI for scheduling)

  **Node 4B — Kit email broadcast:**
  - Node: HTTP Request
  - Method: POST
  - URL: `https://api.kit.com/v4/broadcasts`
  - Headers: `{ "X-Kit-Api-Key": "{{ $env.KIT_API_KEY }}", "Content-Type": "application/json" }`
  - Body:
    ```json
    {
      "subject": "New event: {{ $node["Webhook"].json.body.record.title }}",
      "content": "Hey! A new Family Frequencies event just went live:\n\n{{ $node["Webhook"].json.body.record.title }}\n{{ $node["Webhook"].json.body.record.event_date }} · {{ $node["Webhook"].json.body.record.venue }}\n\nhttps://familyfrequencies.com/event/{{ $node["Webhook"].json.body.record.slug }}\n\nSee you there 🎉"
    }
    ```

  **Node 4C — Telegram ping:**
  - Node: Telegram (existing credential from WF05)
  - Operation: Send Message
  - Chat ID: `{{ $env.TELEGRAM_CHAT_ID }}`
  - Text: `🎉 {{ $node["Webhook"].json.body.record.title }} is live! https://familyfrequencies.com/event/{{ $node["Webhook"].json.body.record.slug }}`

- [ ] **Step 3: Test WF08**

  In Supabase, manually update a test event's status to `published` (then back to `draft`).
  Expected:
  - n8n execution log shows WF08 fired
  - Google Sheet has a new draft row
  - Kit dashboard shows a new broadcast draft
  - Telegram group receives the ping

- [ ] **Step 4: Activate WF08**

  Toggle the workflow to Active in n8n.

---

## Task 21: End-to-end smoke test

- [ ] **Step 1: Create the first aid course event in admin**

  Sign in at `/admin` → "+ Add event":
  - Title: First Aid Course
  - Slug: first-aid-course
  - Date: (upcoming date)
  - Time: 10:00 – 13:00
  - Venue: (your venue)
  - Description: (copy)
  - Chips: Ticketed, All ages
  - ✅ Ticketed event
  - Price: 45.00
  - Capacity: 20
  - Status: (will be set on publish)

  Click "Publish + Create Stripe product" → verify "Published!" appears.

- [ ] **Step 2: Verify Stripe product created**

  Stripe Dashboard → Products → confirm "First Aid Course" product with NZD $45.00 price exists.

- [ ] **Step 3: Verify event page**

  Open `http://localhost:3000/event/first-aid-course` (or production URL).
  Expected: event hero, description, "20 spots remaining", "Get tickets — $45" button.

- [ ] **Step 4: Complete a test purchase**

  Click "Get tickets" → redirected to Stripe hosted checkout.
  Use Stripe test card: `4242 4242 4242 4242`, any future expiry, any CVC.
  Expected: redirected back to `/event/first-aid-course?success=1` with "🎉 You're on the list!" banner.

- [ ] **Step 5: Verify attendee appears in admin**

  Admin → Events → First Aid Course → Attendees.
  Expected: 1 / 20 spots filled, buyer name and email in the table.

- [ ] **Step 6: Test sold-out state**

  In Supabase, set `capacity = 1` and `tickets_sold = 1` on the test event.
  Reload `/event/first-aid-course` → "Sold out" button appears, disabled.

- [ ] **Step 7: Production deploy**

  ```bash
  git push
  ```
  Monitor Vercel dashboard for successful build.
  Smoke test all endpoints on production:
  - `https://familyfrequencies.com/api/events` → JSON array
  - `https://familyfrequencies.com/api/events/first-aid-course` → JSON object
  - `https://familyfrequencies.com/event/first-aid-course` → event page renders
  - `https://familyfrequencies.com/admin` → login form
  - `https://familyfrequencies.com/privacy` → privacy policy
  - `https://familyfrequencies.com/terms` → terms page
  - `https://familyfrequencies.com/waiver` → waiver page
  - `curl -I https://familyfrequencies.com/` → response includes `x-frame-options: DENY`

---

## Self-Review

**Spec coverage:**
- ✅ Supabase schema: ff_events ticketing columns + ff_tickets + record_ticket RPC (Task 10)
- ✅ Security headers + event URL rewrite (Task 11)
- ✅ Public /api/events/[slug] endpoint, strips stripe IDs (Task 12)
- ✅ /api/checkout with input validation + capacity pre-check (Task 13)
- ✅ /api/stripe-webhook with signature verification, idempotency, capacity transaction (Task 14)
- ✅ /api/publish-event: creates Stripe Product + Price, verifies admin JWT (Task 15)
- ✅ Admin ticketing form fields + publish button (Task 16)
- ✅ Admin attendees tab with capacity gauge + CSV export (Task 17)
- ✅ Public /event/[slug] template page with free/ticketed/sold-out/not-yet-open states (Task 18)
- ✅ Privacy Policy, Terms & Conditions, Liability Waiver with footer links (Task 19)
- ✅ n8n WF08: Instagram draft + Kit email + Telegram on publish (Task 20)
- ✅ RLS: anon blocked from ff_tickets; service role used server-side via SUPABASE_SERVICE_ROLE_KEY
- ✅ price_cents always from DB, never from client (Task 13 + 15)
- ✅ STRIPE_WEBHOOK_SECRET signature verification before any DB write (Task 14)
- ✅ Webhook idempotency via ON CONFLICT on stripe_session_id (Task 10 RPC)
- ✅ Capacity race condition: atomic SELECT FOR UPDATE in record_ticket RPC (Task 10 + 14)
- ✅ tickets_sold counter on ff_events for public capacity display without exposing ff_tickets (Task 10)

**Known manual steps (not automatable in plan):**
- Add STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY to Vercel env vars
- Register Stripe webhook endpoint in Stripe Dashboard (Task 14 Step 2)
- Configure Supabase webhook to Railway n8n URL (Task 20 Step 1)
- Waiver content should be reviewed before first aid course goes live
