# Admin Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Supabase-backed admin UI at `/admin` so co-organisers can manage events, and make `events.html` render dynamically from the database instead of hardcoded HTML.

**Architecture:** Supabase stores events in `ff_events` with RLS (anon key reads published/past, authenticated users get full write access). A Vercel serverless function at `/api/events` serves public event JSON to `events.html`. The admin at `/admin` uses the Supabase JS v2 SDK in-browser with email/password auth for CRUD. A separate `/api/stats` serverless function proxies Kit subscriber counts to the admin stats tab.

**Tech Stack:** Supabase (PostgreSQL + auth + RLS), Supabase JS v2 (CDN, browser), Supabase REST API (server-side via native fetch), Kit API v4 (existing), Vercel serverless functions (ES modules, same pattern as `api/subscribe.js`), vanilla HTML/CSS/JS.

---

## File Structure

**Create:**
- `api/events.js` — public `GET /api/events`, returns published + past events JSON using Supabase REST API with anon key
- `api/stats.js` — `GET /api/stats`, returns Kit subscriber totals; uses `KIT_API_KEY` env var (already set)
- `admin/index.html` — single-page admin UI (login + events CRUD + stats)
- `admin/admin.css` — admin styles (independent of site.css; uses same FF design tokens)
- `admin/admin.js` — all admin logic: Supabase auth, events list/create/edit/delete, stats fetch

**Modify:**
- `events.html` — replace hardcoded event card with `<div id="event-list">` + inline `<script>` that fetches `/api/events` and renders cards

**Supabase (via MCP tools):**
- New project: `family-frequencies` (org `bqzejvdhwnbjiltxgghy`, region `ap-southeast-2`)
- Table: `ff_events` with RLS
- Seed: Daylight Disco row

---

## Task 1: Create Supabase project + ff_events table

**Files:** None (Supabase MCP only)

- [ ] **Step 1: Create the Supabase project**

  Use the Supabase MCP tool:
  ```
  mcp__claude_ai_Supabase__create_project
    name: "family-frequencies"
    organization_id: "bqzejvdhwnbjiltxgghy"
    region: "ap-southeast-2"
    db_pass: (generate a strong random password — store it somewhere safe, not in the repo)
  ```
  Wait for the project status to become `ACTIVE_HEALTHY` before proceeding. Use `mcp__claude_ai_Supabase__get_project` to poll.

- [ ] **Step 2: Apply the migration**

  Use `mcp__claude_ai_Supabase__apply_migration` with the project ID from Step 1:

  ```sql
  -- Create ff_events table
  CREATE TABLE ff_events (
    id          uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
    title       text      NOT NULL,
    slug        text      UNIQUE NOT NULL,
    event_date  date      NOT NULL,
    time_start  text,
    time_end    text,
    venue       text      NOT NULL,
    description text,
    image_url   text,
    chips       text[]    DEFAULT '{}',
    status      text      NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'published', 'past')),
    detail_url  text,
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
  );

  -- Enable RLS
  ALTER TABLE ff_events ENABLE ROW LEVEL SECURITY;

  -- Public can read published + past events
  CREATE POLICY "public_read_events" ON ff_events
    FOR SELECT
    USING (status IN ('published', 'past'));

  -- Authenticated users (co-organisers) have full access
  CREATE POLICY "auth_full_access" ON ff_events
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
  ```

- [ ] **Step 3: Seed the Daylight Disco event**

  Use `mcp__claude_ai_Supabase__execute_sql` with the project ID:

  ```sql
  INSERT INTO ff_events (title, slug, event_date, time_start, time_end, venue, description, image_url, chips, status, detail_url)
  VALUES (
    'Daylight Disco',
    'daylight-disco',
    '2026-07-04',
    '12:00',
    '17:00',
    'Hide, Mt Maunganui',
    'A daytime disco for parents who still love a good party, and the kids who''ll out-dance them. Free, walk-in, zero soft-play.',
    'assets/drive-download-20260623T045834Z-3-001/front%20pack%20daddys%20illustration%20only.jpg',
    ARRAY['Free entry', 'All ages', 'Licensed'],
    'published',
    'daylight-disco'
  );
  ```

- [ ] **Step 4: Verify**

  ```sql
  SELECT id, title, status FROM ff_events;
  ```
  Expected: one row, title "Daylight Disco", status "published".

- [ ] **Step 5: Commit**

  ```bash
  git add docs/superpowers/plans/2026-06-27-admin-backend.md
  git commit -m "docs: add admin backend implementation plan"
  ```

---

## Task 2: Capture credentials + add env vars

**Files:** `.env` (local only, gitignored)

- [ ] **Step 1: Get the project URL and anon key**

  Use MCP tools:
  ```
  mcp__claude_ai_Supabase__get_project_url  { project_id: "<id from Task 1>" }
  mcp__claude_ai_Supabase__get_publishable_keys { project_id: "<id from Task 1>" }
  ```
  Note both values. The anon key is safe to embed in client-side HTML (it's public by design; RLS enforces security).

- [ ] **Step 2: Add to local `.env`**

  Append to `/Users/hollyread/Documents/holly-workspace/projects/family-frequencies/.env`:
  ```
  SUPABASE_URL=https://<project-ref>.supabase.co
  SUPABASE_ANON_KEY=<anon-key>
  ```

- [ ] **Step 3: Add to Vercel**

  Run from the FF project directory:
  ```bash
  cd /Users/hollyread/Documents/holly-workspace/projects/family-frequencies
  vercel env add SUPABASE_URL production
  # paste the URL when prompted
  vercel env add SUPABASE_ANON_KEY production
  # paste the anon key when prompted
  ```
  If the Vercel CLI isn't available, add them in the Vercel dashboard under Settings → Environment Variables.

- [ ] **Step 4: Commit (env vars only, not secrets)**

  Nothing to commit — `.env` is gitignored.

---

## Task 3: Public `/api/events.js` endpoint

**Files:**
- Create: `api/events.js`

- [ ] **Step 1: Create `api/events.js`**

  ```js
  export default async function handler(req, res) {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;

    if (!url || !key) {
      console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
      const response = await fetch(
        `${url}/rest/v1/ff_events?select=*&order=event_date.asc`,
        {
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const body = await response.text();
        console.error('Supabase events error:', response.status, body);
        return res.status(502).json({ error: 'Could not load events' });
      }

      const events = await response.json();
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
      return res.status(200).json(events);
    } catch (err) {
      console.error('Events fetch error:', err);
      return res.status(500).json({ error: 'Something went wrong' });
    }
  }
  ```

  Note: The anon key + RLS automatically filters to `status IN ('published', 'past')` — no filter param needed in the URL.

- [ ] **Step 2: Test locally with Vercel dev**

  ```bash
  cd /Users/hollyread/Documents/holly-workspace/projects/family-frequencies
  vercel dev
  # In a new terminal:
  curl http://localhost:3000/api/events
  ```
  Expected: JSON array containing the Daylight Disco event.

- [ ] **Step 3: Commit**

  ```bash
  git add api/events.js
  git commit -m "feat: add public /api/events endpoint backed by Supabase"
  ```

---

## Task 4: Make `events.html` render dynamically

**Files:**
- Modify: `events.html`

Replace the hardcoded event card section with a dynamic JS-rendered version. The existing `.event-card` CSS (lines 77–141) stays in the `<style>` block — only the `<div class="event-list">` content and the past events section change.

- [ ] **Step 1: Add `id` attributes to the event containers and a loading/no-events state**

  In `events.html`, replace the `<section class="events-section">` block (lines 236–281) with:

  ```html
  <section class="events-section">
    <div class="container events-section__inner">
      <p class="eyebrow">Coming up</p>
      <h2 class="section-title">Next up</h2>

      <div id="event-list" class="event-list">
        <!-- JS-rendered -->
      </div>

      <div id="no-events" class="no-events" hidden>
        <p>Nothing else in the diary yet — but we're always cooking something up.<br>Get on the list so you hear first.</p>
      </div>
    </div>
  </section>
  ```

- [ ] **Step 2: Replace the commented-out past events section**

  Replace the `<!-- PAST EVENTS -->` comment block (lines 283–300) with an always-present section that starts hidden:

  ```html
  <section id="past-events-section" class="past-events" hidden>
    <div class="container past-events__inner">
      <p class="eyebrow eyebrow--muted">Past events</p>
      <h2 class="section-title">Previously</h2>
      <div id="past-events-list"></div>
    </div>
  </section>
  ```

- [ ] **Step 3: Add the events rendering script**

  Add this `<script>` block immediately before the closing `</main>` tag in `events.html`:

  ```html
  <script>
    (function () {
      function formatTime(t) {
        if (!t) return '';
        var parts = t.split(':');
        var h = parseInt(parts[0], 10);
        var m = parseInt(parts[1], 10);
        var period = h >= 12 ? 'pm' : 'am';
        var hour = h > 12 ? h - 12 : (h === 0 ? 12 : h);
        return hour + (m ? ':' + String(m).padStart(2, '0') : '') + period;
      }

      function formatDate(dateStr) {
        var p = dateStr.split('-').map(Number);
        var d = new Date(p[0], p[1] - 1, p[2]);
        return d.toLocaleDateString('en-NZ', {
          weekday: 'short', day: 'numeric', month: 'long', year: 'numeric'
        });
      }

      function renderCard(ev) {
        var timeStr = ev.time_start
          ? ' &middot; ' + formatTime(ev.time_start) + (ev.time_end ? '&ndash;' + formatTime(ev.time_end) : '')
          : '';
        var chipsHtml = (ev.chips || []).map(function (c) {
          return '<span class="chip">' + c + '</span>';
        }).join('');
        var imgHtml = ev.image_url
          ? '<img src="' + ev.image_url + '" alt="' + ev.title + '" loading="lazy">'
          : '';
        var statusHtml = ev.status === 'published'
          ? '<span class="status-tag">On now</span>'
          : '';
        var href = ev.detail_url || '#';

        return '<a class="event-card" href="' + href + '">'
          + '<div class="event-card__image">' + imgHtml + statusHtml + '</div>'
          + '<div class="event-card__body">'
          + '<h3>' + ev.title + '</h3>'
          + '<p class="event-card__meta">' + formatDate(ev.event_date) + timeStr + ' &middot; ' + ev.venue + '</p>'
          + (chipsHtml ? '<div class="chip-row">' + chipsHtml + '</div>' : '')
          + '</div>'
          + '<div class="event-card__footer"><span>View event</span><span class="event-card__arrow">&rarr;</span></div>'
          + '</a>';
      }

      function renderPastRow(ev) {
        var p = ev.event_date.split('-').map(Number);
        var d = new Date(p[0], p[1] - 1, p[2]);
        var dateStr = d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
        var href = ev.detail_url || '#';
        return '<a class="past-event-row" href="' + href + '">'
          + '<span class="past-event-row__name">' + ev.title + '</span>'
          + '<span class="past-event-row__date">' + dateStr + '</span>'
          + '</a>';
      }

      fetch('/api/events')
        .then(function (res) {
          if (!res.ok) throw new Error(res.status);
          return res.json();
        })
        .then(function (events) {
          var upcoming = events.filter(function (e) { return e.status === 'published'; });
          var past = events.filter(function (e) { return e.status === 'past'; });

          var listEl = document.getElementById('event-list');
          var noEventsEl = document.getElementById('no-events');

          if (upcoming.length === 0) {
            noEventsEl.hidden = false;
          } else {
            listEl.innerHTML = upcoming.map(renderCard).join('');
          }

          if (past.length > 0) {
            document.getElementById('past-events-list').innerHTML = past.map(renderPastRow).join('');
            document.getElementById('past-events-section').hidden = false;
          }
        })
        .catch(function (err) {
          console.error('Events load error:', err);
          document.getElementById('no-events').hidden = false;
        });
    })();
  </script>
  ```

- [ ] **Step 4: Test in browser**

  ```bash
  vercel dev
  ```
  Open http://localhost:3000/events — should show the Daylight Disco card rendered from the API. Open DevTools → Network tab and confirm the `/api/events` call returns 200 with JSON.

  Edge case: temporarily remove the Daylight Disco row from Supabase and reload — the "Nothing else in the diary yet" message should appear.

- [ ] **Step 5: Commit**

  ```bash
  git add events.html
  git commit -m "feat: render events.html dynamically from /api/events"
  ```

---

## Task 5: Admin UI scaffold (`admin/index.html` + `admin/admin.css`)

**Files:**
- Create: `admin/index.html`
- Create: `admin/admin.css`

- [ ] **Step 1: Create `admin/index.html`**

  ```html
  <!doctype html>
  <html lang="en-NZ">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Admin | Family Frequencies</title>
    <link rel="icon" href="../favicon.svg" type="image/svg+xml">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;900&family=Barlow:wght@500;600;700;800;900&display=swap">
    <link rel="stylesheet" href="admin.css">
  </head>
  <body>

    <!-- Login view -->
    <div id="view-login" class="view">
      <div class="login-box">
        <div class="login-mark">
          <svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="24" cy="13.5" r="6.5" fill="#F0B840"/><path d="M3 33 C7 25 12 25 16 33 C20 41 28 41 32 33 C36 25 41 25 45 33" stroke="#1A2B40" stroke-width="4" stroke-linecap="round"/></svg>
        </div>
        <h1>Family Frequencies<br><span>Admin</span></h1>
        <form id="login-form">
          <label>Email
            <input type="email" id="login-email" required autocomplete="email" placeholder="you@example.com">
          </label>
          <label>Password
            <input type="password" id="login-password" required autocomplete="current-password">
          </label>
          <button type="submit" class="btn-primary">Sign in</button>
          <p id="login-error" class="form-error" aria-live="polite"></p>
        </form>
      </div>
    </div>

    <!-- Dashboard view (hidden until authed) -->
    <div id="view-dashboard" class="view" hidden>
      <header class="admin-header">
        <span class="admin-header__title">FF Admin</span>
        <nav class="admin-nav">
          <button class="tab-btn active" data-tab="events">Events</button>
          <button class="tab-btn" data-tab="stats">Stats</button>
        </nav>
        <button id="btn-logout" class="btn-signout">Sign out</button>
      </header>

      <!-- Events tab -->
      <main id="tab-events" class="tab-content">
        <div class="tab-toolbar">
          <h2>Events</h2>
          <button id="btn-add-event" class="btn-primary">+ Add event</button>
        </div>
        <div id="event-list-admin"></div>

        <!-- Event form (hidden until add/edit clicked) -->
        <div id="event-form-wrap" hidden>
          <h3 id="event-form-title">New event</h3>
          <form id="event-form">
            <label>Title
              <input type="text" name="title" required placeholder="Daylight Disco">
            </label>
            <label>Slug <small>(URL-safe, auto-filled from title)</small>
              <input type="text" name="slug" required pattern="[a-z0-9-]+" placeholder="daylight-disco">
            </label>
            <label>Date
              <input type="date" name="event_date" required>
            </label>
            <div class="form-row">
              <label>Start time
                <input type="time" name="time_start">
              </label>
              <label>End time
                <input type="time" name="time_end">
              </label>
            </div>
            <label>Venue
              <input type="text" name="venue" required placeholder="Hide, Mt Maunganui">
            </label>
            <label>Description
              <textarea name="description" rows="3" placeholder="A daytime disco for parents…"></textarea>
            </label>
            <label>Image URL <small>(relative path or full URL)</small>
              <input type="text" name="image_url" placeholder="assets/myimage.jpg">
            </label>
            <label>Detail page URL <small>(slug of the event detail HTML page)</small>
              <input type="text" name="detail_url" placeholder="daylight-disco">
            </label>
            <label>Chips <small>(comma-separated labels shown on the card)</small>
              <input type="text" name="chips" placeholder="Free entry, All ages, Licensed">
            </label>
            <label>Status
              <select name="status">
                <option value="draft">Draft — not shown publicly</option>
                <option value="published">Published — live on events page</option>
                <option value="past">Past — shown in Previously section</option>
              </select>
            </label>
            <div class="form-actions">
              <button type="submit" class="btn-primary" id="btn-save-event">Save event</button>
              <button type="button" id="btn-cancel-event" class="btn-secondary">Cancel</button>
              <button type="button" id="btn-delete-event" class="btn-danger" hidden>Delete event</button>
            </div>
            <p id="form-error" class="form-error" aria-live="polite"></p>
          </form>
        </div>
      </main>

      <!-- Stats tab -->
      <main id="tab-stats" class="tab-content" hidden>
        <div class="tab-toolbar">
          <h2>Stats</h2>
        </div>
        <div id="stats-content">
          <p class="loading-msg">Loading…</p>
        </div>
      </main>
    </div>

    <!-- Supabase JS SDK (UMD build, exposes global `supabase`) -->
    <!-- Version pinned + SRI hash to guard against CDN compromise -->
    <script
      src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.108.2/dist/umd/supabase.min.js"
      integrity="sha384-JWEyvHh+lRf0sN/WWY+QTQwX+CyWqmNg4tkc8GQzAMEtR2wGNrCJlvnu1lHD1kDm"
      crossorigin="anonymous"
    ></script>
    <!-- Config: fill in AFTER Task 2 gives you the project URL and anon key -->
    <script>
      window.FF_SUPABASE_URL = 'REPLACE_WITH_SUPABASE_URL';
      window.FF_SUPABASE_ANON_KEY = 'REPLACE_WITH_SUPABASE_ANON_KEY';
    </script>
    <script src="admin.js"></script>
  </body>
  </html>
  ```

  After creating the file, replace `REPLACE_WITH_SUPABASE_URL` and `REPLACE_WITH_SUPABASE_ANON_KEY` with the actual values from Task 2.

- [ ] **Step 2: Create `admin/admin.css`**

  ```css
  :root {
    --navy: #1A2B40;
    --cream: #FAF0E0;
    --gold: #F0B840;
    --body: #2d3b4e;
    --muted: #6b7a8d;
    --border: #d4d9e0;
    --radius: 10px;
  }

  *, *::before, *::after { box-sizing: border-box; }

  body {
    margin: 0;
    font-family: 'Barlow', system-ui, sans-serif;
    font-size: 15px;
    background: #f0f2f5;
    color: var(--body);
    -webkit-font-smoothing: antialiased;
  }

  small { font-size: 12px; color: var(--muted); font-weight: 500; }

  /* ── Views ── */
  .view { min-height: 100dvh; }

  /* ── Login ── */
  #view-login {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--navy);
    padding: 24px;
  }

  .login-box {
    width: 100%;
    max-width: 380px;
    background: white;
    border-radius: 20px;
    padding: 36px 32px;
  }

  .login-mark { width: 40px; height: 40px; margin-bottom: 12px; }
  .login-mark svg { width: 100%; height: 100%; }

  .login-box h1 {
    margin: 0 0 28px;
    font-size: 26px;
    font-weight: 900;
    text-transform: uppercase;
    color: var(--navy);
    line-height: 1.1;
    letter-spacing: -0.01em;
  }
  .login-box h1 span { color: var(--gold); }

  /* ── Form elements ── */
  label {
    display: block;
    margin-bottom: 14px;
    font-size: 13px;
    font-weight: 700;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  input[type="text"],
  input[type="email"],
  input[type="password"],
  input[type="date"],
  input[type="time"],
  input[type="url"],
  textarea,
  select {
    display: block;
    width: 100%;
    margin-top: 5px;
    padding: 10px 13px;
    border: 2px solid var(--border);
    border-radius: 8px;
    font-family: inherit;
    font-size: 15px;
    background: white;
    color: var(--body);
    transition: border-color 0.12s;
  }

  input:focus, textarea:focus, select:focus {
    outline: none;
    border-color: var(--navy);
  }

  .form-row {
    display: flex;
    gap: 12px;
  }
  .form-row label { flex: 1; }

  /* ── Buttons ── */
  .btn-primary {
    display: inline-flex;
    align-items: center;
    padding: 10px 20px;
    background: var(--navy);
    color: white;
    border: none;
    border-radius: 8px;
    font-family: inherit;
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: background 0.12s;
  }
  .btn-primary:hover { background: var(--body); }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    padding: 10px 20px;
    background: white;
    color: var(--navy);
    border: 2px solid var(--navy);
    border-radius: 8px;
    font-family: inherit;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.12s;
  }
  .btn-secondary:hover { background: #f0f2f5; }

  .btn-danger {
    display: inline-flex;
    align-items: center;
    padding: 10px 20px;
    background: #b91c1c;
    color: white;
    border: none;
    border-radius: 8px;
    font-family: inherit;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    margin-left: auto;
  }
  .btn-danger:hover { background: #991b1b; }

  .btn-signout {
    padding: 5px 13px;
    background: transparent;
    border: 1px solid rgba(255,255,255,0.25);
    border-radius: 6px;
    color: rgba(255,255,255,0.65);
    font-family: inherit;
    font-size: 12px;
    cursor: pointer;
  }
  .btn-signout:hover { border-color: rgba(255,255,255,0.5); color: white; }

  /* ── Admin header ── */
  .admin-header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 24px;
    background: var(--navy);
    position: sticky;
    top: 0;
    z-index: 10;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  }

  .admin-header__title {
    font-size: 15px;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--gold);
  }

  .admin-nav { display: flex; gap: 8px; margin-left: auto; }

  .tab-btn {
    padding: 6px 16px;
    background: transparent;
    border: 2px solid rgba(255,255,255,0.2);
    border-radius: 6px;
    font-family: inherit;
    font-size: 13px;
    font-weight: 700;
    color: rgba(255,255,255,0.75);
    cursor: pointer;
    transition: all 0.12s;
  }
  .tab-btn.active {
    background: var(--gold);
    border-color: var(--gold);
    color: var(--navy);
  }
  .tab-btn:not(.active):hover { border-color: rgba(255,255,255,0.5); color: white; }

  /* ── Tab content ── */
  .tab-content {
    max-width: 820px;
    margin: 0 auto;
    padding: 28px 24px 60px;
  }

  .tab-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }
  .tab-toolbar h2 {
    margin: 0;
    font-size: 22px;
    font-weight: 900;
    color: var(--navy);
    text-transform: uppercase;
    letter-spacing: -0.01em;
  }

  /* ── Event rows (admin list) ── */
  .event-row {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    background: white;
    border-radius: var(--radius);
    margin-bottom: 10px;
    border: 2px solid var(--border);
  }

  .event-row__info { flex: 1; min-width: 0; }
  .event-row__info strong {
    display: block;
    font-size: 16px;
    font-weight: 800;
    color: var(--navy);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .event-row__meta { font-size: 13px; color: var(--muted); margin-top: 2px; }

  .status-pill {
    flex: none;
    padding: 3px 10px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
  }
  .status-pill--published { background: #dcfce7; color: #166534; }
  .status-pill--draft     { background: #fef9c3; color: #854d0e; }
  .status-pill--past      { background: #e5e7eb; color: #374151; }

  .btn-edit {
    flex: none;
    padding: 6px 14px;
    border: 2px solid var(--navy);
    background: white;
    border-radius: 6px;
    font-family: inherit;
    font-size: 13px;
    font-weight: 700;
    color: var(--navy);
    cursor: pointer;
    transition: all 0.12s;
  }
  .btn-edit:hover { background: var(--navy); color: white; }

  .no-data {
    padding: 24px;
    text-align: center;
    color: var(--muted);
    font-style: italic;
  }

  /* ── Event form ── */
  #event-form-wrap {
    margin-top: 28px;
    padding: 28px;
    background: white;
    border-radius: 16px;
    border: 2px solid var(--border);
  }

  #event-form-title {
    margin: 0 0 24px;
    font-size: 18px;
    font-weight: 900;
    color: var(--navy);
    text-transform: uppercase;
    letter-spacing: -0.01em;
  }

  .form-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 24px;
    flex-wrap: wrap;
  }

  .form-error {
    margin: 8px 0 0;
    min-height: 20px;
    font-size: 13px;
    color: #b91c1c;
  }

  .loading-msg { color: var(--muted); font-style: italic; }

  /* ── Stats ── */
  .stats-grid {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 20px;
  }

  .stat-card {
    flex: 1;
    min-width: 160px;
    padding: 24px;
    background: white;
    border-radius: 14px;
    border: 2px solid var(--border);
    text-align: center;
  }
  .stat-card__value {
    display: block;
    font-size: 48px;
    font-weight: 900;
    color: var(--navy);
    line-height: 1;
  }
  .stat-card__label {
    display: block;
    font-size: 13px;
    color: var(--muted);
    font-weight: 600;
    margin-top: 6px;
  }

  .stats-note {
    font-size: 13px;
    color: var(--muted);
    margin-top: 16px;
  }
  .stats-note a { color: var(--navy); font-weight: 700; }

  .error-msg { color: #b91c1c; }
  ```

- [ ] **Step 3: Verify the login page renders**

  ```bash
  vercel dev
  ```
  Open http://localhost:3000/admin — should show the login form. Nothing else functional yet (admin.js doesn't exist).

- [ ] **Step 4: Commit**

  ```bash
  git add admin/index.html admin/admin.css
  git commit -m "feat: add admin UI scaffold with login + dashboard layout"
  ```

---

## Task 6: Admin auth (`admin/admin.js` — login/logout)

**Files:**
- Create: `admin/admin.js`

- [ ] **Step 1: Create `admin/admin.js` with auth only**

  ```js
  /* global supabase */
  const { createClient } = supabase;
  const sb = createClient(window.FF_SUPABASE_URL, window.FF_SUPABASE_ANON_KEY);

  // ── State ────────────────────────────────────────
  let currentEventId = null;
  let allEvents = [];

  // ── Boot ─────────────────────────────────────────
  async function init() {
    const { data: { session } } = await sb.auth.getSession();
    session ? showDashboard() : showLogin();

    sb.auth.onAuthStateChange((_event, session) => {
      session ? showDashboard() : showLogin();
    });
  }

  // ── Auth helpers ─────────────────────────────────
  function showLogin() {
    document.getElementById('view-login').hidden = false;
    document.getElementById('view-dashboard').hidden = true;
  }

  function showDashboard() {
    document.getElementById('view-login').hidden = true;
    document.getElementById('view-dashboard').hidden = false;
    loadEvents();
  }

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');
    errEl.textContent = '';

    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) errEl.textContent = error.message;
  });

  document.getElementById('btn-logout').addEventListener('click', () => {
    sb.auth.signOut();
  });

  // ── Tabs ─────────────────────────────────────────
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.tab-content').forEach(t => { t.hidden = (t.id !== `tab-${tab}`); });
      if (tab === 'stats') loadStats();
    });
  });

  // ── Events: placeholder (filled in Task 7) ────────
  async function loadEvents() {
    document.getElementById('event-list-admin').innerHTML = '<p class="no-data">Loading events…</p>';
  }

  // ── Stats: placeholder (filled in Task 8) ─────────
  async function loadStats() {}

  // ── Start ─────────────────────────────────────────
  init();
  ```

- [ ] **Step 2: Test login in browser**

  Open http://localhost:3000/admin. Enter a bad password — should show an error message. 
  
  To test a real login: in the Supabase dashboard for the `family-frequencies` project, go to Authentication → Users → Invite user, and invite yourself (holly.e.dodson@gmail.com). Accept the invite email to set a password, then sign in at /admin. After login, the dashboard header should appear with "Events" and "Stats" tabs and a "Sign out" button.

- [ ] **Step 3: Commit**

  ```bash
  git add admin/admin.js
  git commit -m "feat: add admin auth (Supabase email/password login)"
  ```

---

## Task 7: Admin events CRUD

**Files:**
- Modify: `admin/admin.js`

Replace the placeholder `loadEvents()` function (and add all CRUD wiring) in `admin/admin.js`.

- [ ] **Step 1: Replace `loadEvents` + add CRUD event listeners**

  Replace the events section in `admin/admin.js` (from `// ── Events: placeholder` to just before `// ── Stats`) with:

  ```js
  // ── Events CRUD ──────────────────────────────────

  async function loadEvents() {
    const listEl = document.getElementById('event-list-admin');
    listEl.innerHTML = '<p class="no-data">Loading…</p>';

    const { data, error } = await sb.from('ff_events').select('*').order('event_date');
    if (error) {
      listEl.innerHTML = '<p class="no-data">Failed to load events.</p>';
      console.error(error);
      return;
    }

    allEvents = data;

    if (!data.length) {
      listEl.innerHTML = '<p class="no-data">No events yet. Click "+ Add event" to create one.</p>';
      return;
    }

    listEl.innerHTML = data.map(ev => `
      <div class="event-row">
        <div class="event-row__info">
          <strong>${ev.title}</strong>
          <span class="event-row__meta">${ev.event_date}${ev.venue ? ' · ' + ev.venue : ''}</span>
        </div>
        <span class="status-pill status-pill--${ev.status}">${ev.status}</span>
        <button class="btn-edit" data-id="${ev.id}">Edit</button>
      </div>
    `).join('');

    listEl.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const ev = allEvents.find(e => e.id === btn.dataset.id);
        if (ev) openForm(ev);
      });
    });
  }

  document.getElementById('btn-add-event').addEventListener('click', () => openForm(null));

  function slugify(str) {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function openForm(event) {
    currentEventId = event ? event.id : null;
    const form = document.getElementById('event-form');
    const wrap = document.getElementById('event-form-wrap');

    document.getElementById('event-form-title').textContent = event ? 'Edit event' : 'New event';
    document.getElementById('btn-delete-event').hidden = !event;
    document.getElementById('form-error').textContent = '';
    form.reset();

    if (event) {
      form.title.value       = event.title ?? '';
      form.slug.value        = event.slug ?? '';
      form.event_date.value  = event.event_date ?? '';
      form.time_start.value  = event.time_start ?? '';
      form.time_end.value    = event.time_end ?? '';
      form.venue.value       = event.venue ?? '';
      form.description.value = event.description ?? '';
      form.image_url.value   = event.image_url ?? '';
      form.detail_url.value  = event.detail_url ?? '';
      form.chips.value       = (event.chips || []).join(', ');
      form.status.value      = event.status ?? 'draft';
    }

    wrap.hidden = false;
    wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Auto-slug from title on new events
  document.getElementById('event-form').title.addEventListener('input', (e) => {
    if (!currentEventId) {
      document.getElementById('event-form').slug.value = slugify(e.target.value);
    }
  });

  document.getElementById('btn-cancel-event').addEventListener('click', () => {
    document.getElementById('event-form-wrap').hidden = true;
    currentEventId = null;
  });

  document.getElementById('event-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('form-error');
    errEl.textContent = '';
    document.getElementById('btn-save-event').textContent = 'Saving…';

    const form = e.target;
    const payload = {
      title:       form.title.value.trim(),
      slug:        form.slug.value.trim(),
      event_date:  form.event_date.value,
      time_start:  form.time_start.value || null,
      time_end:    form.time_end.value || null,
      venue:       form.venue.value.trim(),
      description: form.description.value.trim() || null,
      image_url:   form.image_url.value.trim() || null,
      detail_url:  form.detail_url.value.trim() || null,
      chips:       form.chips.value
                     ? form.chips.value.split(',').map(s => s.trim()).filter(Boolean)
                     : [],
      status:      form.status.value,
      updated_at:  new Date().toISOString(),
    };

    let error;
    if (currentEventId) {
      ({ error } = await sb.from('ff_events').update(payload).eq('id', currentEventId));
    } else {
      ({ error } = await sb.from('ff_events').insert(payload));
    }

    document.getElementById('btn-save-event').textContent = 'Save event';

    if (error) {
      errEl.textContent = error.message;
      return;
    }

    document.getElementById('event-form-wrap').hidden = true;
    currentEventId = null;
    loadEvents();
  });

  document.getElementById('btn-delete-event').addEventListener('click', async () => {
    if (!currentEventId) return;
    if (!confirm('Delete this event? This cannot be undone.')) return;

    const { error } = await sb.from('ff_events').delete().eq('id', currentEventId);
    if (error) {
      document.getElementById('form-error').textContent = error.message;
      return;
    }

    document.getElementById('event-form-wrap').hidden = true;
    currentEventId = null;
    loadEvents();
  });
  ```

- [ ] **Step 2: Test CRUD flows in the browser**

  Sign in at http://localhost:3000/admin.

  **Create:** Click "+ Add event" → fill in a test event (title: "Test Workshop", date: 2026-08-01, venue: "Test Venue", status: Draft) → Save. Verify it appears in the list with "draft" pill.

  **Edit:** Click Edit on the test event → change status to "Published" → Save. Verify the pill updates.

  **Delete:** Click Edit → click "Delete event" → confirm. Verify it disappears from the list.

  **Verify Daylight Disco is still intact** — it should appear in the list as "published".

- [ ] **Step 3: Commit**

  ```bash
  git add admin/admin.js
  git commit -m "feat: add events CRUD to admin dashboard"
  ```

---

## Task 8: `/api/stats.js` + admin stats tab

**Files:**
- Create: `api/stats.js`
- Modify: `admin/admin.js` (replace `loadStats` placeholder)

- [ ] **Step 1: Create `api/stats.js`**

  ```js
  export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).end();

    const apiKey = process.env.KIT_API_KEY;
    if (!apiKey) {
      console.error('Missing KIT_API_KEY');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const headers = {
      'Content-Type': 'application/json',
      'X-Kit-Api-Key': apiKey,
    };

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    try {
      const [totalRes, recentRes] = await Promise.all([
        fetch('https://api.kit.com/v4/subscribers?page[size]=1', { headers }),
        fetch(`https://api.kit.com/v4/subscribers?page[size]=1&created_after=${thirtyDaysAgo}`, { headers }),
      ]);

      if (!totalRes.ok) {
        const body = await totalRes.text();
        console.error('Kit total error:', totalRes.status, body);
        return res.status(502).json({ error: 'Kit API error' });
      }

      const [totalData, recentData] = await Promise.all([
        totalRes.json(),
        recentRes.json(),
      ]);

      return res.status(200).json({
        totalSubscribers: totalData.pagination?.total_count ?? 0,
        newLast30Days: recentRes.ok ? (recentData.pagination?.total_count ?? 0) : 0,
      });
    } catch (err) {
      console.error('Stats error:', err);
      return res.status(500).json({ error: 'Something went wrong' });
    }
  }
  ```

  **Note:** The `created_after` param name may differ in the Kit v4 API. Test with:
  ```bash
  curl -H "X-Kit-Api-Key: $KIT_API_KEY" "https://api.kit.com/v4/subscribers?page[size]=1"
  ```
  Check the response shape — if `pagination.total_count` doesn't exist, look at the actual JSON keys and adjust accordingly. Kit docs: https://developers.kit.com/

- [ ] **Step 2: Replace `loadStats` in `admin/admin.js`**

  Replace the placeholder function:
  ```js
  async function loadStats() {
    const statsEl = document.getElementById('stats-content');
    statsEl.innerHTML = '<p class="loading-msg">Loading stats…</p>';

    try {
      const res = await fetch('/api/stats');
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();

      statsEl.innerHTML = `
        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-card__value">${data.totalSubscribers}</span>
            <span class="stat-card__label">Total subscribers</span>
          </div>
          <div class="stat-card">
            <span class="stat-card__value">${data.newLast30Days}</span>
            <span class="stat-card__label">New in last 30 days</span>
          </div>
        </div>
        <p class="stats-note">Email stats from Kit &middot; <a href="https://app.kit.com" target="_blank" rel="noopener">Open Kit dashboard &rarr;</a></p>
      `;
    } catch (err) {
      console.error('Stats error:', err);
      statsEl.innerHTML = '<p class="error-msg">Could not load stats. Check the KIT_API_KEY environment variable.</p>';
    }
  }
  ```

- [ ] **Step 3: Test the stats tab**

  ```bash
  curl http://localhost:3000/api/stats
  ```
  Expected: `{"totalSubscribers": N, "newLast30Days": M}` where N is the actual Kit subscriber count.

  In the browser: sign in at /admin → click "Stats" tab → verify the numbers appear.

- [ ] **Step 4: Commit**

  ```bash
  git add api/stats.js admin/admin.js
  git commit -m "feat: add stats tab with Kit subscriber counts"
  ```

---

## Task 9: Deploy + invite co-organiser

**Files:** None

- [ ] **Step 1: Deploy to Vercel**

  ```bash
  cd /Users/hollyread/Documents/holly-workspace/projects/family-frequencies
  git push
  ```
  Vercel auto-deploys on push. Watch the deployment at https://vercel.com/dashboard or run `vercel --prod` to force.

- [ ] **Step 2: Smoke test on production**

  - https://familyfrequencies.com/events — Daylight Disco card loads from API (not hardcoded)
  - https://familyfrequencies.com/admin — login form loads
  - https://familyfrequencies.com/api/events — returns JSON array
  - https://familyfrequencies.com/api/stats — returns subscriber counts

- [ ] **Step 3: Invite a co-organiser**

  To add a co-organiser who can log in to /admin:
  1. Go to https://app.supabase.com → family-frequencies project → Authentication → Users
  2. Click "Invite user" → enter their email address
  3. They receive an invitation email to set their password
  4. Once they've set their password, they can log in at https://familyfrequencies.com/admin

  Holly keeps co-organiser accounts managed entirely from the Supabase dashboard — no code changes needed to add/remove users.

- [ ] **Step 4: Final commit**

  If any config tweaks were needed during deploy:
  ```bash
  git add -p
  git commit -m "chore: production tweaks after deploy"
  ```

---

## Self-Review

**Spec coverage:**
- ✅ Co-organisers can log in at /admin and add/edit/delete events
- ✅ Events auto-update the public events page (fetched from Supabase on load)
- ✅ Stats: email subscriber count from Kit
- ✅ Seed: existing Daylight Disco event migrated to Supabase (no regression)
- ✅ Auth: Supabase email/password; Holly invites co-organisers via Supabase dashboard
- ✅ No framework added (vanilla JS, matching existing site pattern)

**Gaps/notes:**
- Page views aren't tracked via this system — Vercel Analytics handles that automatically; the Vercel dashboard at vercel.com is the right place for page view data. Adding it here would require the Vercel Analytics API (paid plan feature) and isn't worth the complexity.
- Kit's `created_after` param for recent subscribers may need verification against Kit docs — Task 8 includes a note and a curl test for this.
- The admin URL `/admin` has no additional protection beyond Supabase auth. If you want to obscure it, move to `/a/<random-slug>` in the future — but Supabase auth is sufficient protection for now.
