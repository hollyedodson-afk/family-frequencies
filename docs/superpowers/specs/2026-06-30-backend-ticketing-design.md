# FF Backend + Ticketing — Design Spec

**Date:** 2026-06-30
**Status:** Approved — ready for implementation planning
**Scope:** Admin dashboard backend, event template system, Stripe ticketing, legal pages, n8n publish automation

---

## Overview

Extend familyfrequencies.com (static HTML + Vercel) with:
1. A Supabase-backed admin dashboard at `/admin` for co-organisers to manage events
2. A dynamic event template page (`/event.html`) that renders any event from the database
3. Stripe Checkout ticketing for paid events (first pilot: first aid course)
4. Attendee management in the admin dashboard
5. Legal pages (privacy policy, terms, liability waiver)
6. n8n automation to publish social/email/Telegram when an event goes live

This builds on the existing approved admin plan (`docs/superpowers/plans/2026-06-27-admin-backend.md`) — Tasks 1–9 of that plan run first and are unchanged. This spec adds the ticketing extension tasks on top.

---

## Architecture

```
familyfrequencies.com
│
├── /events              ← dynamic from Supabase (existing admin plan Task 4)
├── /event.html?slug=X   ← NEW single event template page
├── /daylight-disco.html ← static (free, walk-in — unchanged)
├── /privacy.html        ← NEW
├── /terms.html          ← NEW
├── /waiver.html         ← NEW (liability waiver for physical events)
│
├── /admin               ← co-organiser dashboard (existing admin plan Tasks 5–8)
│     ├── Events tab      CRUD + ticketing fields + Publish action
│     ├── Attendees tab   NEW — per-event ticket list, capacity gauge, CSV export
│     └── Stats tab       Kit subscriber counts
│
├── /api/events          ← public event feed (existing plan Task 3)
├── /api/events/[slug]   ← NEW single event endpoint for template page
├── /api/stats           ← Kit subscriber count (existing plan Task 8)
├── /api/checkout        ← NEW: creates Stripe Checkout session
└── /api/stripe-webhook  ← NEW: records ticket on payment success
```

Stripe handles the payment page, card processing, and sends buyer email receipts automatically. We never touch card data.

When a ticketed event is published, the admin Vercel function creates the Stripe Product + Price synchronously and writes the IDs back to Supabase. The admin sees "Live — tickets open" before the page confirms.

After publish, a Supabase webhook fires to n8n (WF08) which handles social/email/Telegram async in the background.

---

## Data Model

### `ff_events` — extended from admin plan

Existing fields (from admin plan):
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
title       text NOT NULL
slug        text UNIQUE NOT NULL
event_date  date NOT NULL
time_start  text
time_end    text
venue       text NOT NULL
description text
image_url   text
chips       text[] DEFAULT '{}'
status      text NOT NULL DEFAULT 'draft'
            CHECK (status IN ('draft', 'published', 'past'))
detail_url  text
created_at  timestamptz DEFAULT now()
updated_at  timestamptz DEFAULT now()
```

New ticketing fields:
```sql
is_ticketed         boolean NOT NULL DEFAULT false
capacity            integer          -- null = unlimited
price_cents         integer          -- null if free; NZD cents
ticket_sale_opens   timestamptz      -- null = open immediately on publish
stripe_product_id   text             -- auto-filled on publish
stripe_price_id     text             -- auto-filled on publish
```

### `ff_tickets` — new

```sql
CREATE TABLE ff_tickets (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          uuid NOT NULL REFERENCES ff_events(id),
  stripe_session_id text UNIQUE NOT NULL,  -- idempotency key
  buyer_name        text NOT NULL,
  buyer_email       text NOT NULL,
  quantity          integer NOT NULL DEFAULT 1,
  ticket_type       text NOT NULL DEFAULT 'general',  -- festival-ready
  amount_paid_cents integer NOT NULL,
  created_at        timestamptz DEFAULT now()
);
```

`ticket_type` is always `'general'` now but supports early bird / VIP / etc. for the festival without a migration.

---

## RLS Policies

### `ff_events`
```sql
-- Anon: published and past events only
CREATE POLICY "public_read_events" ON ff_events
  FOR SELECT USING (status IN ('published', 'past'));

-- Authenticated: full CRUD
CREATE POLICY "auth_full_access" ON ff_events
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
```

### `ff_tickets`
```sql
-- Anon: no access
-- Authenticated admins: read only (view attendees, cannot delete)
CREATE POLICY "auth_read_tickets" ON ff_tickets
  FOR SELECT USING (auth.role() = 'authenticated');

-- Service role (Vercel webhook function): insert only
-- Handled via SUPABASE_SERVICE_ROLE_KEY bypassing RLS server-side
```

---

## Security Model

### Stripe
- Webhook signature verified with `STRIPE_WEBHOOK_SECRET` before any DB write
- `stripe_price_id` sourced from database, never from client request (prevents price manipulation)
- `payment_status === 'paid'` checked before writing ticket
- `stripe_session_id UNIQUE` prevents double-writes on webhook retry

### Capacity race condition
Checked at two points:
1. **Checkout creation:** reject if `sold_tickets >= capacity` (prevents buying into a sold-out event)
2. **Webhook handler:** Supabase transaction with `SELECT COUNT(*) FOR UPDATE` before insert — if count >= capacity, abort and trigger Stripe refund

### Input validation on `/api/checkout`
- `event_id` must be valid UUID, exist in `ff_events`, status = `published`, `is_ticketed = true`
- `quantity` must be positive integer, max 10
- Capacity check before creating Stripe session

### Environment variables
```
Private (Vercel env only — never in client HTML):
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
  SUPABASE_SERVICE_ROLE_KEY   ← webhook function only
  KIT_API_KEY

Safe to embed in client HTML (RLS enforces data access):
  SUPABASE_URL
  SUPABASE_ANON_KEY
```

### HTTP security headers (vercel.json)
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
        { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' 'unsafe-inline' js.stripe.com cdn.jsdelivr.net fonts.googleapis.com; style-src 'self' 'unsafe-inline' fonts.googleapis.com; font-src fonts.gstatic.com; img-src 'self' data: res.cloudinary.com; connect-src 'self' api.stripe.com *.supabase.co; frame-src checkout.stripe.com" }
      ]
    }
  ]
}
```

---

## Stripe Checkout Flow

```
User clicks "Get tickets" on /event.html
      ↓
POST /api/checkout { event_id, quantity }
      ↓
Server: validate event, check capacity, look up stripe_price_id from DB
      ↓
stripe.checkout.sessions.create({
  line_items: [{ price: stripe_price_id, quantity }],
  mode: 'payment',
  metadata: { event_id, quantity },
  customer_creation: 'always',
  success_url: '/confirmed.html?event={slug}',
  cancel_url: '/event.html?slug={slug}',
})
      ↓
Redirect to Stripe hosted checkout page
      ↓
Payment completes → Stripe fires webhook to /api/stripe-webhook
      ↓
Verify signature → check payment_status === 'paid'
      ↓
Supabase transaction: check capacity, INSERT ff_tickets
      ↓
User lands on /confirmed.html
```

---

## Admin Event Form — Ticketing Fields

The event form adds a Ticketing section below existing fields:

```
[ ] Ticketed event

  (visible when toggled on):
  Price (NZD)      [  45.00  ]
  Capacity         [  20     ]
  Tickets open     [date/time]   ← leave blank = open on publish

  Stripe product   [auto — set on publish]
```

Publish button behaviour for ticketed events:
- Shows "Publishing…" while Vercel function creates Stripe Product + Price
- On success: updates stripe_product_id + stripe_price_id in Supabase, sets status = published
- On failure: shows error, status stays draft

---

## Admin Attendees Tab

Visible per event in the event list:
```
[Edit] [Attendees ↗]
```

Attendees view:
```
First Aid Course — Attendees

████████░░  8 / 20 spots filled (40% remaining)

Name              Email                  Qty   Purchased
Holly Read        holly@example.com      1     14 Jul 12:03pm
Jane Smith        jane@example.com       2     14 Jul 2:17pm
...

                                         [Export CSV]
```

CSV columns: `name, email, quantity, ticket_type, amount_paid, purchased_at`

---

## Public Event Template Page (`/event.html`)

Single page, URL pattern: `/event.html?slug=first-aid-course`

Fetches from `/api/events/[slug]` and renders:

**Free event:**
- Hero image, title, date/time/venue, chips
- Description
- "Free entry — just turn up" message

**Ticketed event (tickets available):**
- Price badge, "X spots remaining"
- "Get tickets — $45" button → calls `/api/checkout`

**Ticketed event (sold out):**
- "Sold out" badge, button disabled

**Ticketed event (not yet on sale):**
- "Tickets open [date]" with countdown

On successful payment: lands on `/confirmed.html?event=first-aid-course` with confirmation message and event details.

---

## Legal Pages

### `/privacy.html` — Privacy Policy (NZ Privacy Act 2020)

Covers:
- Email addresses collected via mailing list signup (processed by Kit)
- Name, email, payment data collected via ticket purchases (processed by Stripe, stored in Supabase)
- Anonymous page view analytics (Vercel Analytics — no cookies, no personal data)
- Purpose of collection, third parties, retention period
- How to request access, correction, or deletion (contact: holly.e.dodson@gmail.com)

### `/terms.html` — Terms & Conditions

Covers:
- Refund policy: full refund if event cancelled or postponed; no refund if attendee cannot attend
- Substitution: ticket holders may transfer their ticket to another person
- Event cancellation: FF will notify via email and Instagram; refunds processed within 5 business days
- Photography and video: events are photographed for social media; attendees consent by attending
- Age requirements: all ages welcome unless stated on specific event
- Venue rules apply

### `/waiver.html` — Liability Waiver (physical events)

For first aid course and other events involving physical activity:
- Acknowledgement of physical nature of practical exercises
- Participant confirms they are fit to participate
- Release of liability for injury during practical exercises (except gross negligence)
- Medical conditions: attendees must disclose relevant conditions on registration

**Note:** The liability waiver content should be reviewed before the first aid course goes live. Draft will be included in the build for legal review. Emergency contact field is out of scope for v1 (requires Stripe custom fields + schema column) — add in a future iteration.

Stripe checkout for physical events adds:
*"By purchasing you agree to our [Terms & Conditions], [Privacy Policy], and [Liability Waiver]."*

---

## n8n WF08 — Event Published Automation

**Trigger:** Supabase webhook on `ff_events` UPDATE where `status` changes to `'published'`

**Steps:**
1. Filter: only fire if status changed from non-published to published
2. Fetch full event record from Supabase
3. **Instagram draft:** compose post copy + image URL → insert row into Google Sheet scheduler queue (same sheet as social scheduler)
4. **Kit email:** create broadcast to all subscribers — "New event: [title] on [date] at [venue]" with link
5. **Telegram ping:** send to FF group chat — "🎉 [Event] is live at familyfrequencies.com/event.html?slug=[slug]"

Free and ticketed events both trigger. Ticketed events include ticket link in Instagram draft and email.

**n8n is deployed on Railway** — public URL available, no blocker. Supabase webhooks can POST to it directly. WF08 can be implemented in any order relative to Tasks 1–19.

---

## File Changes Summary

**New files:**
- `api/events/[slug].js` — single event endpoint
- `api/checkout.js` — create Stripe Checkout session
- `api/stripe-webhook.js` — handle payment completion
- `event.html` — public event template page
- `privacy.html` — privacy policy
- `terms.html` — terms and conditions
- `waiver.html` — liability waiver

**Modified files:**
- `api/events.js` — (existing plan Task 3, unchanged)
- `events.html` — (existing plan Task 4, unchanged)
- `admin/index.html` — add ticketing fields to event form, Attendees button
- `admin/admin.css` — attendees view styles, capacity gauge
- `admin/admin.js` — ticketing form logic, publish action, Attendees tab
- `vercel.json` — add security headers
- `css/site.css` — confirmed page styles, event template styles
- `.env` — add STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY

**Supabase (via MCP):**
- Existing admin plan Tasks 1–3: create project, apply migration, seed Daylight Disco
- Extended migration: add ticketing columns to ff_events, create ff_tickets table, add RLS policies

---

## Implementation Order

1. **Tasks 1–9 from existing admin plan** — foundation (Supabase, /api/events, events.html dynamic, admin scaffold, auth, events CRUD, stats, deploy)
2. **Task 10:** Extend ff_events schema + create ff_tickets + RLS
3. **Task 11:** /api/events/[slug] single event endpoint
4. **Task 12:** /api/checkout — create Stripe session
5. **Task 13:** /api/stripe-webhook — record ticket on payment
6. **Task 14:** Add ticketing fields + Publish action to admin event form
7. **Task 15:** Admin Attendees tab (list + capacity gauge + CSV export)
8. **Task 16:** /event.html public template page
9. **Task 17:** /confirmed.html ticket confirmation page update
10. **Task 18:** Legal pages (privacy, terms, waiver)
11. **Task 19:** vercel.json security headers
12. **Task 20:** n8n WF08 event-published automation
13. **Task 21:** End-to-end smoke test (purchase a test ticket, verify attendee appears in admin)
