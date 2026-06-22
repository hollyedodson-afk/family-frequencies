# Handoff: Family Frequencies — brand site v1

## Overview
Family Frequencies (FF) is a family-friendly daytime-events brand in Mt Maunganui / Tauranga, NZ. This bundle is the **v1 website**: a Family Frequencies hub page plus a Daylight Disco event page. The site's job is to tell people what's on, where, and when, and to make FF feel worth following. It is free/walk-in — **no booking, ticketing, or accounts**. Mobile-first, share-friendly (people arrive from an Instagram bio/story link on their phone).

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes showing the intended look and behaviour, **not production code to ship directly**. They are authored in a proprietary "Design Component" (`.dc.html`) format that depends on the bundled `support.js` runtime; treat that as a rendering harness, **not** something to port. The task is to **recreate these designs in the target environment** using its established patterns. Per the product brief the recommended stack is **plain static HTML/CSS/JS on Vercel** (no React/SPA needed); Astro is a fine option if templating across many events becomes useful. This README is the source of truth — a developer who wasn't in the conversation should be able to build from it alone.

## Fidelity
**High-fidelity.** Final colours, type, spacing, copy, and interactions. Recreate pixel-accurately. All hex values, font weights, and sizes below are exact.

---

## Brand foundations

### Logo
- **Symbol — "daybreak swell":** a gold sun disc above a navy rolling-wave stroke. SVG (48×48 viewBox):
  ```html
  <svg viewBox="0 0 48 48" fill="none">
    <circle cx="24" cy="13.5" r="6.5" fill="#F0B840"/>
    <path d="M3 33 C7 25 12 25 16 33 C20 41 28 41 32 33 C36 25 41 25 45 33"
          stroke="#1A2B40" stroke-width="4" stroke-linecap="round"/>
  </svg>
  ```
  Reversed on navy: wave stroke becomes cream `#FAF0E0`, sun stays gold. The stroke width of 4 (at 48 viewbox) is the locked proportion — scale the whole SVG, don't restroke.
- **Wordmark:** two stacked lines, Barlow Condensed, uppercase, `line-height:0.78`.
  - Line 1 "FAMILY" — weight 600, `letter-spacing:0.05em`.
  - Line 2 "FREQUENCIES" — weight 800, `letter-spacing:0.03em`, colour gold `#F0B840` on dark / navy `#1A2B40` on light.
- **Horizontal lockup** (header): symbol left, stacked wordmark right, `gap:11px`.

### Daylight Disco artwork
- Locked illustrated poster (`assets/daylight-disco-reference.png`, 2048×1478). Black linework, halftone dots, yellow/blue accents. **Does not get recoloured** to the parent palette — it is the event sub-brand and is intentionally brighter. Always present it inside the FF "framed poster" treatment (see Components).

---

## Design Tokens

### Colours
| Token | Hex | Use |
|---|---|---|
| Navy | `#1A2B40` | Primary brand, dark sections, text, borders |
| Navy-deep (hover) | `#0E1A2A` | Dark button hover |
| Cream | `#FAF0E0` | App background, light text on navy |
| Gold | `#F0B840` | Accent, CTAs, sun, drop-shadow |
| Gold-bright (hover) | `#FFC85A` | Gold CTA hover |
| Rose | `#E88070` | Ticker bg, signup section bg, accent pops |
| Body text on cream | `#3D4A5C` | Secondary paragraph text |
| Eyebrow gold-brown | `#C99A2E` | Eyebrow labels on cream |
| Muted label | `#B89A5E` | Small uppercase labels on cream |
| Fact divider | `#E7D8BC` | 2px row dividers on cream |
| Card border (soft) | `#ECDCBC` | Programme card borders |
| Rose text-dark | `#5A2B25` / `#6B332B` | Text on rose |
| Footer muted | `#7C8799` | Footer location line |

Section background pattern: cream → navy → cream → rose, separated by wave dividers.

### Typography
- **Family:** `Barlow Condensed` (Google Fonts), weights 500/600/700/800/900. Single typeface for the whole brand.
- **Headlines:** weight 800–900, UPPERCASE, `letter-spacing:-0.015em` to `-0.025em`, `line-height:0.8–0.96`. Hero H1 `clamp(64px,19vw,104px)`. Section H2 `clamp(34px,9vw,50px)`.
- **Body:** weight 500, `line-height:1.35–1.45`, ~18–22px. Constrain to ~30–42ch.
- **Eyebrow labels:** 13px, weight 800, UPPERCASE, `letter-spacing:0.18em`.
- **Small facts labels:** 11px, weight 800, UPPERCASE, `letter-spacing:0.12em`.
- **Accent words** inside headlines coloured rose `#E88070` (e.g. "Disco", "kids").

### Radii
- Pills / CTAs: `9999px` · Cards: `20px` · Inputs/buttons: `12px` · Programme rows: `16px` · Notice box: `16px`.

### Shadows / borders
- **Framed poster & event card:** `border:3px solid #1A2B40` + hard offset shadow `box-shadow:8px 8px 0 #F0B840` (no blur — flat poster aesthetic).
- Facts/dividers: `2px solid #E7D8BC`.
- Programme cards: `2px solid #ECDCBC`.

### Spacing
- Content max-width **600px**, centred, `padding:0 22px` horizontal.
- Section vertical padding ~40–56px. Mobile-first; nothing wider than the 600px column.

---

## Screens / Views

### 1. Family Frequencies — Hub (`Family Frequencies.dc.html`)
- **Purpose:** permanent front door / brand home; lists what's on; routes to event pages; captures email.
- **Layout (top→bottom):**
  1. **Sticky header** (h 62px, navy): logo lockup (links to hub) left; gold **"Join the club"** pill → `#signup` right.
  2. **Ticker** (rose, `border-bottom:3px solid navy`): marquee of "DAYTIME CLUB CULTURE · FOR FAMILIES · BAY OF PLENTY ·" scrolling left, 24s linear infinite loop (duplicated track for seamlessness).
  3. **Brand hero** (navy): centred. Large bobbing swell mark (92px), stacked wordmark `clamp(48px,15vw,76px)`, tagline, gold "See what's on →" CTA → navigates to `Daylight Disco.dc.html`. Faint gold sun circle (300px, opacity 0.14) bleeding off top.
  4. **Wave divider** (navy, flipped) into cream.
  5. **What's on** (`id="whats-on"`, cream): eyebrow + "Next up" H2 + **featured event card** (see Components) → navigates to event page.
  6. **Programme** (cream): "The programme" + 4 future-event rows (First Aid Courses, Nutritionist Talks, Family-Friendly Gigs, Workshops), each a card with a "Soon" tag.
  7. **Wave divider** into rose.
  8. **Signup** (`id="signup"`, rose): "Get on the list" + email form.
  9. **Footer** (navy): swell mark, stacked wordmark, location line "Mt Maunganui · Aotearoa New Zealand", `@familyfrequencies` link.

### 2. Daylight Disco — Event page (`Daylight Disco.dc.html`)
- **Purpose:** the launch/share URL; everything a stranger needs in <30s.
- **Layout (top→bottom):**
  1. **Sticky header** (navy): logo lockup → links to hub; gold **"Join the club"** pill → `#signup`.
  2. **Ticker** (rose): "DAYLIGHT DISCO · SAT 4 JULY · FREE ENTRY · BRING THE KIDS ·", 22s loop.
  3. **Hero** (cream): eyebrow "Family Frequencies presents"; H1 "Daylight / **Disco**" (Disco in rose); intro paragraph; **framed poster** with **rotating + bobbing event stamp** overlapping its bottom-right; then **3 fact rows** (When/Where/Entry) each with a round icon badge.
  4. **Wave divider** into navy.
  5. **On the day** (navy): "Fun for mum & dad — and of course the **kids**" + 5 vibe pills (Jazz house, Kids boogie songs, **Face painting** [gold], Toys, **Good times** [rose]) + paragraph.
  6. **Wave divider** (flipped) back to cream.
  7. **About FF** (cream): logo lockup + brand paragraph.
  8. **Signup** (`id="signup"`, rose), **Programme**, **Footer** — same as hub.

---

## Components

### Header (both pages)
- `position:sticky; top:0; z-index:30`, navy, height 62px, inner column max 600px.
- Left: logo lockup wrapped in `<a>` → hub. Right: gold pill "Join the club", 12px/800/uppercase/`0.1em`, `padding:8px 14px`, radius pill.
- Pill hover: bg `#FFC85A`, `translateY(-1px)`; active: `scale(0.96)`; `transition:.14s ease`.

### Ticker / marquee
- Outer: rose bg, `overflow:hidden`, `border-bottom:3px solid #1A2B40`.
- Inner: `display:flex; width:max-content; animation:ff-marquee Ns linear infinite` where `@keyframes ff-marquee { from{translateX(0)} to{translateX(-50%)} }`. Track content duplicated once (2nd copy `aria-hidden`) so the −50% wrap is seamless.
- Items: 15px/800/uppercase/`0.14em` navy, separated by cream `●` bullets, `gap:18px`.

### Framed poster
- `background:#fff; border:3px solid #1A2B40; border-radius:20px; padding:12px; box-shadow:8px 8px 0 #F0B840`. Image inside `border-radius:10px`, full width.

### Event stamp (event-page hero, over poster bottom-right)
- 104px square, `position:absolute; bottom:-22px; right:-6px`.
- Outer ring: circular SVG `<textPath>` reading "FREE · WALK IN · ALL AGES · GOOD TIMES ·" (Barlow 15.5px/800, `letter-spacing:3.2`, navy) on a 44r circle path, **rotating** `@keyframes ff-spin { to { transform:rotate(360deg) } }` 18s linear infinite.
- Inner gold disc (`inset:26px`, gold, `2px solid navy`): "12–6" (21px/900) over "PM" (10px/800).
- Whole stamp **bobs**: `@keyframes ff-bob` rotate(8deg) ±7px, 5s ease-in-out infinite. (Hub hero mark uses a plain `translateY` bob, no rotate.)

### Fact rows (event page)
- Row: `display:flex; align-items:center; gap:14px; padding:13px 2px`; first two `border-bottom:2px solid #E7D8BC`.
- Icon badge: 44px circle, tinted bg (gold `rgba(240,184,64,0.24)` for When/Entry, rose `rgba(232,128,112,0.22)` for Where), centred 22px stroke icon (navy, `stroke-width:2`, round caps/joins).
- Text block: label (11px/800/uppercase/`0.12em`, `#B89A5E`) over value (21px/600), `line-height:1`, `margin-top:3px`.

### Icons (hand-rolled, 24×24, stroke `#1A2B40`, width 2, round joins)
- **Calendar (When):** `<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>`
- **Pin (Where):** `<path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>`
- **Ticket (Entry):** `<path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H5a2 2 0 0 1-2-2 2 2 0 0 0 0-4Z"/><path d="M13 7v10" stroke-dasharray="2 3"/>`
- Lucide is a fine substitute family if more icons are needed (same stroke weight/joins).

### Vibe pills (event "On the day")
- 17px/700, `padding:9px 16px`, radius pill. Neutral pills: `rgba(250,240,224,0.08)` bg + `1.5px rgba(250,240,224,0.2)` border, cream text. Highlighted: solid gold or rose bg with navy text.

### Featured event card (hub "What's on")
- `<a>` → `Daylight Disco.dc.html`. Framed-poster styling (3px navy border, radius 20, `8px 8px 0 #F0B840`).
- Poster image with "On now" gold tag absolutely placed top-left (11px/800/uppercase).
- Body (white, `border-top:3px solid navy`): H3 "Daylight Disco" (32px/900), date/venue line (17px/600 `#3D4A5C`), two outline info chips ("Free entry", "All ages").
- **Footer bar** (navy): "VIEW EVENT" (16px/800/uppercase) + gold "→". This bar is what signals the whole card is a link.
- Card hover: `translate(-2px,-2px)` + shadow grows to `12px 12px 0`; active: `translate(2px,2px)` + shadow `5px 5px 0`; `transition:.16s ease`.

### Programme rows
- White card, `2px solid #ECDCBC`, radius 16, `padding:16px 18px`, `display:flex; justify-content:space-between`. Title 22px/800/uppercase; right tag "Soon" (11px/800/uppercase `#B89A5E`) or "On now" (navy text on gold pill).

### Wave divider
- Full-width SVG, `viewBox="0 0 600 40"`, `preserveAspectRatio="none"`, height 40px, `display:block` (kill inline-gap). Path is a scalloped wave filled with the **section it borders** (navy entering a navy section; rose entering rose). Flip with `transform:rotate(180deg)` when transitioning dark→light.

### Email signup
- Section bg rose. H2 "Get on the list" / "Don't miss the next one" (navy, 900, uppercase). Subcopy on rose.
- Form: `display:flex; flex-wrap:wrap; gap:10px`. Email input `flex:1 1 200px`, cream bg, `2px solid navy`, radius 12, 18px/500. Submit button navy, cream text, 15px/800/uppercase, radius 12; hover `#0E1A2A`, active `scale(0.96)`.
- On submit (prototype): `preventDefault`, show note "You're on the list — see you on the dancefloor." **In production wire to the chosen mailing-list provider (Mailchimp/Kit/Beehiiv — TBD).**

### Footer
- Navy. Centred swell mark (46px) + stacked wordmark + location line (`#7C8799`) + gold `@familyfrequencies` link.

---

## Interactions & Behavior
- **Navigation:** logo → hub; hub hero "See what's on →" and the featured card → event page; "Join the club" (both headers) → `#signup` smooth-scroll (`html { scroll-behavior:smooth }`). Hub "What's on" header context scrolls to `#whats-on`.
- **Animations:** marquee (22–24s linear infinite), stamp spin (18s linear) + bob (5s ease-in-out), hero-mark bob (5s). All gentle/looping — no scroll-triggered reveals (intentional: content must be readable instantly for the <30s share goal). Respect `prefers-reduced-motion` in production (pause marquee/spin/bob).
- **Hover/press:** pills & buttons lift + darken on hover, squish (`scale ~0.96`) on active; event card lifts its hard shadow. `transition:.14–.16s ease`.
- **Responsive:** single 600px column, fluid `clamp()` headings, `flex-wrap` on pills/forms. No horizontal scroll. Designed phone-first.

## State Management
Minimal. Only the signup form holds state: a single `signupNote` string set on submit. No accounts, no fetching, no routing state. Each page is static; "event state" (upcoming vs wrapped) on the event page is a simple flag that, when `wrapped`, shows a navy notice banner at the top of the hero and can hide/keep the signup + programme. For multiple events later, drive the hub's "What's on" + programme from a small array/JSON of event objects `{title, date, venue, status, href, poster}`.

## Assets
- `assets/daylight-disco-reference.png` — Daylight Disco poster, 2048×1478, illustrated (locked sub-brand artwork). Confirm a full-res web export exists. No other photography (none exists yet by design).
- All icons and the logo are inline SVG (above) — no icon font / external CDN.
- Font: Barlow Condensed via Google Fonts.

## Files
- `Family Frequencies.dc.html` — hub page design reference
- `Daylight Disco.dc.html` — event page design reference
- `assets/daylight-disco-reference.png` — event artwork
- `support.js` — DC runtime harness (rendering only; **do not port**)

## Open questions (from brief)
- Domain (familyfrequencies.co.nz vs .nz vs .com).
- Mailing-list provider (Mailchimp / Kit / Beehiiv) — wire the form to it.
- Final Daylight Disco web copy + confirmed full-res artwork export.
