# Family Frequencies Brand Build — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Family Frequencies brand system (design tokens, four SVG logo configs, brand stylesheet) and the Daylight Disco event page — ready to share publicly before 4 July 2026.

**Architecture:** Pure static HTML/CSS — no build tooling, no npm. All brand values live in a single `brand/tokens.css` file as CSS custom properties; every other file imports from there. SVG logos are used inline in HTML (so Google Fonts loads from the parent page). The event page is `index.html` at the project root.

**Tech Stack:** HTML5, CSS custom properties, SVG, Google Fonts (Barlow Condensed 600/800)

---

## File Map

| File | Responsibility |
|------|---------------|
| `brand/tokens.css` | Single source of truth — all palette hex values, font stack |
| `brand/logo-symbol.svg` | Wave mark only — for IG avatar, favicon, watermark |
| `brand/logo-stacked.svg` | Symbol above wordmark — for IG post header strip, signage |
| `brand/logo-horizontal.svg` | Symbol left, wordmark right — for website header, email |
| `brand/logo-stamp.svg` | "A FAMILY FREQUENCIES EVENT" mini lockup — for event posters |
| `brand/brand.css` | Typography classes, colour utilities, logo component styles |
| `css/site.css` | Layout, header, nav, sections, footer, event card |
| `index.html` | Daylight Disco event page — the live site home |

> **Note on SVGs and fonts:** SVG files use `<text>` elements that inherit font from the parent HTML page. They work perfectly when embedded inline or as `<object>`. If exported as standalone files for Canva/Figma/print, the text must be converted to paths — flag this when handing to a printer.

---

## Task 1: Design Tokens

**Files:**
- Create: `brand/tokens.css`

- [ ] **Step 1: Create the tokens file**

```css
/* brand/tokens.css
   Single source of truth. Import this first in every stylesheet.
   Do not hardcode any colour or font outside this file. */

:root {
  /* ── Palette: Pacific Dusk ── */
  --ff-navy:  #1A2B40;
  --ff-cream: #FAF0E0;
  --ff-gold:  #F0B840;
  --ff-rose:  #E88070;

  /* ── Wave arc opacities (navy background context) ── */
  --ff-wave-gold:  #F0B840;
  --ff-wave-rose:  rgba(232, 128, 112, 0.70);
  --ff-wave-cream: rgba(250, 240, 224, 0.30);

  /* ── Typography ── */
  --ff-font: 'Barlow Condensed', sans-serif;

  /* ── Spacing scale ── */
  --ff-space-xs:  4px;
  --ff-space-sm:  8px;
  --ff-space-md:  16px;
  --ff-space-lg:  32px;
  --ff-space-xl:  64px;
  --ff-space-2xl: 120px;

  /* ── Type scale ── */
  --ff-text-xs:   11px;
  --ff-text-sm:   13px;
  --ff-text-base: 16px;
  --ff-text-lg:   20px;
  --ff-text-xl:   28px;
  --ff-text-2xl:  40px;
  --ff-text-3xl:  64px;
  --ff-text-hero: clamp(56px, 10vw, 100px);
}
```

- [ ] **Step 2: Verify file exists**

```bash
ls brand/tokens.css
```
Expected: `brand/tokens.css`

- [ ] **Step 3: Commit**

```bash
git add brand/tokens.css
git commit -m "brand: add design tokens (Pacific Dusk palette)"
```

---

## Task 2: Wave Mark SVG (Symbol Only)

**Files:**
- Create: `brand/logo-symbol.svg`

This is the most-used logo config — IG avatar, favicon, watermark. Must work in a circle crop at 400×400px.

- [ ] **Step 1: Create the symbol SVG**

```svg
<!-- brand/logo-symbol.svg
     Three concentric wave arcs on transparent background.
     viewBox is 80×48 — use as inline SVG or <object>.
     For <img> use: font will not load; this file has no text so that's fine. -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 48" fill="none" role="img" aria-label="Family Frequencies wave mark">
  <!-- Front arc — Gold -->
  <path d="M4 42 Q20 12 40 30 Q60 48 76 22"
        stroke="#F0B840" stroke-width="4" stroke-linecap="round" fill="none"/>
  <!-- Mid arc — Rose at 70% -->
  <path d="M4 30 Q20 0 40 18 Q60 36 76 10"
        stroke="#E88070" stroke-width="3.5" stroke-linecap="round" fill="none" opacity="0.70"/>
  <!-- Back arc — Cream at 30% -->
  <path d="M4 18 Q20 -12 40 6 Q60 24 76 -2"
        stroke="#FAF0E0" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.30"/>
</svg>
```

- [ ] **Step 2: Open in browser and verify**

Open `brand/logo-symbol.svg` directly in Safari/Chrome.

Expected: Three smooth wave arcs on a transparent/white background. Front arc is most visible (gold), mid arc is slightly faded rose, back arc is barely-there cream. No clipping, no jagged edges.

- [ ] **Step 3: Commit**

```bash
git add brand/logo-symbol.svg
git commit -m "brand: add wave mark symbol SVG"
```

---

## Task 3: Logo Lockups (Stacked, Horizontal, Stamp)

**Files:**
- Create: `brand/logo-stacked.svg`
- Create: `brand/logo-horizontal.svg`
- Create: `brand/logo-stamp.svg`

These SVGs use `<text>` elements. They render correctly when embedded inline in HTML (where Barlow Condensed is loaded). For standalone file preview, open in Chrome (not Safari — Safari has inconsistent SVG text rendering with Google Fonts).

- [ ] **Step 1: Create the stacked lockup**

Symbol above two-line wordmark. viewBox tall enough for both.

```svg
<!-- brand/logo-stacked.svg
     For IG post header strip, signage, square crops.
     Embed inline in HTML — do not use as <img src> (font won't load). -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 100" fill="none" role="img" aria-label="Family Frequencies">
  <defs>
    <style>
      .ff-wordmark { font-family: 'Barlow Condensed', sans-serif; text-transform: uppercase; }
    </style>
  </defs>

  <!-- Wave mark, centred at top -->
  <g transform="translate(20, 4)">
    <path d="M4 42 Q20 12 40 30 Q60 48 76 22"
          stroke="#F0B840" stroke-width="4" stroke-linecap="round" fill="none"/>
    <path d="M4 30 Q20 0 40 18 Q60 36 76 10"
          stroke="#E88070" stroke-width="3.5" stroke-linecap="round" fill="none" opacity="0.70"/>
    <path d="M4 18 Q20 -12 40 6 Q60 24 76 -2"
          stroke="#FAF0E0" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.30"/>
  </g>

  <!-- FAMILY — lighter weight -->
  <text x="60" y="66"
        class="ff-wordmark"
        font-size="22" font-weight="600" fill="#FAF0E0"
        text-anchor="middle" letter-spacing="1.5">FAMILY</text>

  <!-- FREQUENCIES — heavier weight, gold -->
  <text x="60" y="88"
        class="ff-wordmark"
        font-size="22" font-weight="800" fill="#F0B840"
        text-anchor="middle" letter-spacing="1.5">FREQUENCIES</text>
</svg>
```

- [ ] **Step 2: Create the horizontal lockup**

Symbol left, wordmark right. For website header — the most common usage.

```svg
<!-- brand/logo-horizontal.svg
     For website header, email, letterhead.
     Embed inline in HTML. -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 48" fill="none" role="img" aria-label="Family Frequencies">
  <defs>
    <style>
      .ff-wordmark { font-family: 'Barlow Condensed', sans-serif; text-transform: uppercase; }
    </style>
  </defs>

  <!-- Wave mark, left-aligned -->
  <path d="M4 42 Q20 12 40 30 Q60 48 76 22"
        stroke="#F0B840" stroke-width="4" stroke-linecap="round" fill="none"/>
  <path d="M4 30 Q20 0 40 18 Q60 36 76 10"
        stroke="#E88070" stroke-width="3.5" stroke-linecap="round" fill="none" opacity="0.70"/>
  <path d="M4 18 Q20 -12 40 6 Q60 24 76 -2"
        stroke="#FAF0E0" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.30"/>

  <!-- FAMILY — lighter, top line -->
  <text x="88" y="22"
        class="ff-wordmark"
        font-size="18" font-weight="600" fill="#FAF0E0"
        letter-spacing="1.5">FAMILY</text>

  <!-- FREQUENCIES — heavier, gold, bottom line -->
  <text x="88" y="40"
        class="ff-wordmark"
        font-size="18" font-weight="800" fill="#F0B840"
        letter-spacing="1.5">FREQUENCIES</text>
</svg>
```

- [ ] **Step 3: Create the event stamp**

Mini horizontal: small wave mark + "A FAMILY FREQUENCIES EVENT". Used at bottom of event posters.

```svg
<!-- brand/logo-stamp.svg
     For event posters — bottom right or bottom centre.
     Should not exceed ~10% of poster's shorter dimension at print size.
     Embed inline in HTML. -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 28" fill="none" role="img" aria-label="A Family Frequencies Event">
  <defs>
    <style>
      .ff-stamp { font-family: 'Barlow Condensed', sans-serif; text-transform: uppercase; }
    </style>
  </defs>

  <!-- Mini wave mark -->
  <g transform="scale(0.42) translate(0, -10)">
    <path d="M4 42 Q20 12 40 30 Q60 48 76 22"
          stroke="#FAF0E0" stroke-width="5" stroke-linecap="round" fill="none"/>
    <path d="M4 30 Q20 0 40 18 Q60 36 76 10"
          stroke="#FAF0E0" stroke-width="5" stroke-linecap="round" fill="none" opacity="0.55"/>
    <path d="M4 18 Q20 -12 40 6 Q60 24 76 -2"
          stroke="#FAF0E0" stroke-width="5" stroke-linecap="round" fill="none" opacity="0.30"/>
  </g>

  <!-- Divider line -->
  <line x1="38" y1="6" x2="38" y2="22" stroke="#FAF0E0" stroke-width="1" opacity="0.3"/>

  <!-- Stamp text -->
  <text x="46" y="18"
        class="ff-stamp"
        font-size="12" font-weight="700" fill="#FAF0E0"
        letter-spacing="1.8" opacity="0.85">A Family Frequencies Event</text>
</svg>
```

- [ ] **Step 4: Open each lockup in browser and verify**

Open each SVG as a standalone file in Chrome. Check:
- Wave arcs render with correct gold/rose/cream stroke colours
- Text is readable (note: if Chrome shows fallback font, that's OK — the font loads correctly when inline in HTML)
- No clipping at the edges of the viewBox

- [ ] **Step 5: Commit**

```bash
git add brand/logo-stacked.svg brand/logo-horizontal.svg brand/logo-stamp.svg
git commit -m "brand: add logo lockups (stacked, horizontal, stamp)"
```

---

## Task 4: Brand Stylesheet

**Files:**
- Create: `brand/brand.css`

- [ ] **Step 1: Create the brand stylesheet**

```css
/* brand/brand.css
   Import after tokens.css. Defines typography utilities and logo component styles.
   Does not define layout — that's in css/site.css. */

@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;800&display=swap');
@import url('../brand/tokens.css');

/* ── Reset ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* ── Base ── */
body {
  font-family: var(--ff-font);
  background: var(--ff-cream);
  color: var(--ff-navy);
  -webkit-font-smoothing: antialiased;
}

/* ── Typography utilities ── */
.ff-eyebrow {
  font-size: var(--ff-text-xs);
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.ff-label {
  font-size: var(--ff-text-sm);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.ff-title {
  font-size: var(--ff-text-3xl);
  font-weight: 800;
  line-height: 0.88;
  letter-spacing: -0.02em;
  text-transform: uppercase;
}

.ff-hero {
  font-size: var(--ff-text-hero);
  font-weight: 800;
  line-height: 0.85;
  letter-spacing: -0.03em;
  text-transform: uppercase;
}

/* ── Colour utilities ── */
.bg-navy  { background: var(--ff-navy); }
.bg-cream { background: var(--ff-cream); }
.text-cream { color: var(--ff-cream); }
.text-gold  { color: var(--ff-gold); }
.text-rose  { color: var(--ff-rose); }
.text-navy  { color: var(--ff-navy); }

/* ── Wave mark inline SVG sizing ── */
.ff-mark-sm  { width: 32px; height: 20px; }
.ff-mark-md  { width: 56px; height: 34px; }
.ff-mark-lg  { width: 80px; height: 48px; }
.ff-mark-xl  { width: 120px; height: 72px; }

/* ── Logo lockup classes (used on inline SVGs) ── */
.ff-logo-horizontal { display: block; height: 40px; width: auto; }
.ff-logo-stacked    { display: block; height: 80px; width: auto; }
.ff-logo-stamp      { display: block; height: 20px; width: auto; }
```

- [ ] **Step 2: Commit**

```bash
git add brand/brand.css
git commit -m "brand: add brand stylesheet (typography, colour utilities)"
```

---

## Task 5: Daylight Disco Event Page

**Files:**
- Create: `css/site.css`
- Create: `index.html`

This is the production website. Single-page: header, hero (Daylight Disco), event details, footer. Uses the Daylight Disco reference artwork at `assets/daylight-disco-reference.png`.

- [ ] **Step 1: Create the site stylesheet**

```css
/* css/site.css
   Layout, header, sections, footer.
   Imports brand.css (which imports tokens.css and Google Fonts). */

@import url('../brand/brand.css');

/* ── Site header ── */
.site-header {
  background: var(--ff-navy);
  padding: 0 var(--ff-space-lg);
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 100;
}

.site-header__logo {
  display: flex;
  align-items: center;
  gap: var(--ff-space-sm);
  text-decoration: none;
}

.site-header__logo svg { display: block; }

.site-nav {
  display: flex;
  gap: var(--ff-space-lg);
  list-style: none;
}

.site-nav a {
  font-family: var(--ff-font);
  font-size: var(--ff-text-sm);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ff-cream);
  text-decoration: none;
  opacity: 0.5;
  transition: opacity 0.15s;
}

.site-nav a:hover { opacity: 1; }

/* ── Hero ── */
.hero {
  background: var(--ff-navy);
  padding: var(--ff-space-2xl) var(--ff-space-lg) var(--ff-space-xl);
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--ff-space-xl);
  align-items: center;
  min-height: 80vh;
}

.hero__content { max-width: 580px; }

.hero__eyebrow {
  color: var(--ff-gold);
  margin-bottom: var(--ff-space-md);
}

.hero__title {
  color: var(--ff-cream);
  margin-bottom: var(--ff-space-lg);
}

.hero__meta {
  display: flex;
  flex-direction: column;
  gap: var(--ff-space-sm);
  margin-bottom: var(--ff-space-xl);
}

.hero__meta-item {
  color: var(--ff-rose);
  display: flex;
  align-items: center;
  gap: var(--ff-space-sm);
}

.hero__meta-item span { color: var(--ff-cream); opacity: 0.7; }

.hero__free-tag {
  display: inline-flex;
  align-items: center;
  gap: var(--ff-space-xs);
  background: var(--ff-gold);
  color: var(--ff-navy);
  padding: 6px 16px;
  border-radius: 100px;
  font-size: var(--ff-text-sm);
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.hero__artwork {
  position: relative;
}

.hero__artwork img {
  width: 100%;
  border-radius: 16px;
  display: block;
}

/* ── Event details section ── */
.event-details {
  background: var(--ff-cream);
  padding: var(--ff-space-xl) var(--ff-space-lg);
  max-width: 800px;
  margin: 0 auto;
}

.event-details__heading {
  font-size: var(--ff-text-xl);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ff-navy);
  margin-bottom: var(--ff-space-lg);
  padding-bottom: var(--ff-space-md);
  border-bottom: 2px solid var(--ff-navy);
}

.event-details__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--ff-space-lg) var(--ff-space-xl);
}

.detail-item__label {
  font-size: var(--ff-text-xs);
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ff-rose);
  margin-bottom: 4px;
}

.detail-item__value {
  font-size: var(--ff-text-lg);
  font-weight: 700;
  color: var(--ff-navy);
  line-height: 1.2;
}

/* ── Footer ── */
.site-footer {
  background: var(--ff-navy);
  padding: var(--ff-space-xl) var(--ff-space-lg);
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}

.site-footer__stamp { opacity: 0.6; }

.site-footer__credit {
  color: var(--ff-cream);
  font-size: var(--ff-text-xs);
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  opacity: 0.3;
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .hero {
    grid-template-columns: 1fr;
    min-height: auto;
    padding: var(--ff-space-xl) var(--ff-space-md);
  }

  .hero__artwork { order: -1; }

  .event-details__grid { grid-template-columns: 1fr; }

  .site-footer {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--ff-space-lg);
  }

  .site-nav { display: none; } /* mobile: hide nav for now */
}
```

- [ ] **Step 2: Create index.html**

All SVGs are inline (so Barlow Condensed loads from the `<head>` link and applies to SVG `<text>` elements).

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Daylight Disco — Family Frequencies</title>
  <meta name="description" content="A free family-friendly daytime disco at Hide, Mt Maunganui. 4 July 2026, 12pm–6pm." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;800&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="css/site.css" />
</head>
<body>

  <!-- ── Site Header ── -->
  <header class="site-header">
    <a href="/" class="site-header__logo" aria-label="Family Frequencies home">
      <!-- Horizontal logo — inline SVG so font applies -->
      <svg width="180" height="40" viewBox="0 0 200 48" fill="none" role="img" aria-label="Family Frequencies">
        <path d="M4 42 Q20 12 40 30 Q60 48 76 22"
              stroke="#F0B840" stroke-width="4" stroke-linecap="round" fill="none"/>
        <path d="M4 30 Q20 0 40 18 Q60 36 76 10"
              stroke="#E88070" stroke-width="3.5" stroke-linecap="round" fill="none" opacity="0.70"/>
        <path d="M4 18 Q20 -12 40 6 Q60 24 76 -2"
              stroke="#FAF0E0" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.30"/>
        <text x="88" y="22"
              font-family="'Barlow Condensed', sans-serif"
              font-size="18" font-weight="600" fill="#FAF0E0"
              letter-spacing="1.5" text-transform="uppercase">FAMILY</text>
        <text x="88" y="40"
              font-family="'Barlow Condensed', sans-serif"
              font-size="18" font-weight="800" fill="#F0B840"
              letter-spacing="1.5" text-transform="uppercase">FREQUENCIES</text>
      </svg>
    </a>
    <nav aria-label="Site navigation">
      <ul class="site-nav">
        <li><a href="#event">This Event</a></li>
        <li><a href="#details">Details</a></li>
      </ul>
    </nav>
  </header>

  <!-- ── Hero ── -->
  <section class="hero" id="event">
    <div class="hero__content">
      <p class="ff-eyebrow hero__eyebrow">Family Frequencies presents</p>
      <h1 class="ff-hero hero__title">Daylight<br>Disco</h1>
      <div class="hero__meta">
        <div class="hero__meta-item ff-label">
          <span>4 July 2026</span>
        </div>
        <div class="hero__meta-item ff-label">
          <span>12pm – 6pm</span>
        </div>
        <div class="hero__meta-item ff-label">
          <span>Hide, Mt Maunganui</span>
        </div>
      </div>
      <span class="hero__free-tag">Free Entry</span>
    </div>

    <div class="hero__artwork">
      <img src="assets/daylight-disco-reference.png"
           alt="Daylight Disco illustrated poster — parents and babies DJing, with yellow, blue and black linework"
           width="600" />
    </div>
  </section>

  <!-- ── Event Details ── -->
  <section class="event-details" id="details">
    <h2 class="event-details__heading">Event Details</h2>
    <div class="event-details__grid">
      <div class="detail-item">
        <div class="detail-item__label">Date</div>
        <div class="detail-item__value">Friday 4 July 2026</div>
      </div>
      <div class="detail-item">
        <div class="detail-item__label">Time</div>
        <div class="detail-item__value">12pm – 6pm</div>
      </div>
      <div class="detail-item">
        <div class="detail-item__label">Venue</div>
        <div class="detail-item__value">Hide<br>Mt Maunganui</div>
      </div>
      <div class="detail-item">
        <div class="detail-item__label">Entry</div>
        <div class="detail-item__value">Free<br><small style="font-size:14px;font-weight:600;opacity:0.5;">No booking required</small></div>
      </div>
      <div class="detail-item">
        <div class="detail-item__label">Music</div>
        <div class="detail-item__value">Jazz, House &amp;<br>Kids Boogie Songs</div>
      </div>
      <div class="detail-item">
        <div class="detail-item__label">Activities</div>
        <div class="detail-item__value">Face Painting<br>Toys &amp; Good Times</div>
      </div>
    </div>
  </section>

  <!-- ── Footer ── -->
  <footer class="site-footer">
    <div class="site-footer__stamp">
      <!-- Event stamp — inline SVG -->
      <svg width="200" height="24" viewBox="0 0 220 28" fill="none" role="img" aria-label="A Family Frequencies Event">
        <g transform="scale(0.42) translate(0, -10)">
          <path d="M4 42 Q20 12 40 30 Q60 48 76 22"
                stroke="#FAF0E0" stroke-width="5" stroke-linecap="round" fill="none"/>
          <path d="M4 30 Q20 0 40 18 Q60 36 76 10"
                stroke="#FAF0E0" stroke-width="5" stroke-linecap="round" fill="none" opacity="0.55"/>
          <path d="M4 18 Q20 -12 40 6 Q60 24 76 -2"
                stroke="#FAF0E0" stroke-width="5" stroke-linecap="round" fill="none" opacity="0.30"/>
        </g>
        <line x1="38" y1="6" x2="38" y2="22" stroke="#FAF0E0" stroke-width="1" opacity="0.3"/>
        <text x="46" y="18"
              font-family="'Barlow Condensed', sans-serif"
              font-size="12" font-weight="700" fill="#FAF0E0"
              letter-spacing="1.8" opacity="0.85">A FAMILY FREQUENCIES EVENT</text>
      </svg>
    </div>
    <p class="site-footer__credit">Mt Maunganui, NZ</p>
  </footer>

</body>
</html>
```

- [ ] **Step 3: Open in browser and verify**

```bash
open index.html
```

Check:
- Header is navy with horizontal logo (wave mark + FAMILY/FREQUENCIES in gold/cream)
- Hero: "Daylight Disco" in large cream type, date/time/venue in rose, "Free Entry" gold pill
- Daylight Disco artwork renders (if the PNG is missing, you'll see a broken image — that's fine, the artwork file exists at `assets/daylight-disco-reference.png`)
- Event details grid renders cleanly
- Footer has the stamp lockup and credit
- Resize window to 375px wide — hero stacks vertically, artwork moves to top

- [ ] **Step 4: Commit**

```bash
git add css/site.css index.html
git commit -m "site: add Daylight Disco event page"
```

---

## Task 6: Instagram Strip Export Page

**Files:**
- Create: `brand/ig-strip.html`

This is a browser-screenshot-ready page sized for Instagram header strip (1080×420). Screenshot it with DevTools set to 1080px wide to export.

- [ ] **Step 1: Create the IG strip page**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=1080" />
  <title>FF Instagram Strip — Export</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;800&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #1A2B40; }

    .strip {
      width: 1080px;
      height: 420px;
      background: #1A2B40;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 20px;
    }

    .strip__mark svg { display: block; }

    .strip__wordmark {
      font-family: 'Barlow Condensed', sans-serif;
      text-transform: uppercase;
      text-align: center;
      line-height: 0.88;
      letter-spacing: 0.04em;
    }

    .strip__family {
      font-size: 64px;
      font-weight: 600;
      color: #FAF0E0;
      display: block;
    }

    .strip__frequencies {
      font-size: 64px;
      font-weight: 800;
      color: #F0B840;
      display: block;
    }
  </style>
</head>
<body>
  <div class="strip">
    <div class="strip__mark">
      <svg width="120" height="72" viewBox="0 0 80 48" fill="none">
        <path d="M4 42 Q20 12 40 30 Q60 48 76 22"
              stroke="#F0B840" stroke-width="4" stroke-linecap="round" fill="none"/>
        <path d="M4 30 Q20 0 40 18 Q60 36 76 10"
              stroke="#E88070" stroke-width="3.5" stroke-linecap="round" fill="none" opacity="0.70"/>
        <path d="M4 18 Q20 -12 40 6 Q60 24 76 -2"
              stroke="#FAF0E0" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.30"/>
      </svg>
    </div>
    <div class="strip__wordmark">
      <span class="strip__family">Family</span>
      <span class="strip__frequencies">Frequencies</span>
    </div>
  </div>
</body>
</html>
```

- [ ] **Step 2: Open and screenshot**

```bash
open brand/ig-strip.html
```

In Chrome DevTools: set viewport to exactly 1080×420. Take a screenshot (DevTools → three dots → Capture screenshot → Capture node screenshot on the `.strip` div, or use Cmd+Shift+4 with dimensions set).

Save to `brand/exports/ig-strip.png` — this is your Instagram header image.

- [ ] **Step 3: Commit**

```bash
git add brand/ig-strip.html
git commit -m "brand: add Instagram strip export page"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|-----------------|------------|
| Symbol: three concentric wave arcs | Task 2 — `logo-symbol.svg` |
| Wordmark: FAMILY FREQUENCIES, condensed, weight contrast | Tasks 3 & 5 — all SVG lockups + inline SVGs |
| Palette: navy, cream, gold, rose | Task 1 — `tokens.css` |
| Horizontal lockup | Task 3 — `logo-horizontal.svg` + inline in `index.html` header |
| Stacked lockup | Task 3 — `logo-stacked.svg` + `ig-strip.html` |
| Symbol only | Task 2 — `logo-symbol.svg` |
| Event stamp | Task 3 — `logo-stamp.svg` + inline in `index.html` footer |
| Website header | Task 5 — `index.html` + `site.css` |
| Instagram strip | Task 6 — `ig-strip.html` |
| Poster stamp | Task 3 — `logo-stamp.svg` (place on poster in Canva/Figma) |
| Daylight Disco event page | Task 5 — `index.html` |

**Not in scope (per spec):** animation, photography direction, future event illustration styles, path-converted print-ready logos.

**One gap flagged:** The spec mentions "Symbol only for Instagram avatar" — this is `logo-symbol.svg` (Task 2). To export a 400×400 circular-cropped avatar PNG, open `logo-symbol.svg` in Chrome, resize viewport to 400×400, screenshot. No additional task needed — just a usage note.
