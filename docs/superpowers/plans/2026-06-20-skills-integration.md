# Family Frequencies — New Skills Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock the brand direction, build the Daylight Disco event page (needed by 27 June 2026), then use new skills to generate brand assets and event promotion content.

**Architecture:** Three phases: (A) lock brand direction + build event page fast with design-taste-frontend, (B) brand assets with brandkit, (C) event promotion content with motion-graphics or slideshow.

**Tech Stack:** Static HTML/CSS/JS (walking skeleton first, no framework needed for an event page). Hosting TBD — Vercel or Netlify are the fastest path.

**Current state:** Three brand direction mockups exist (A/B/C). Impeccable critique of Option C scored 21/40. Shape-directions board at `mockups/shape-directions.html`. Moodboard generation paused. **Daylight Disco is July 4, 2026 — ~2 weeks away.**

---

## Phase A — Brand lock + Event page

The event is July 4 (~2 weeks away). Lock brand direction this weekend so the page can be built early next week.

### Task 1: Lock brand direction (30 min decision session)

This is a decision, not a build task. No code.

- [ ] **Step 1: Open the shape directions board**
```bash
open /Users/hollyread/Documents/holly-workspace/projects/family-frequencies/mockups/shape-directions.html
```
This shows the three revised directions: Daytime Club Culture, Community Radio/Frequencies, and Family-Friendly Gig Crew.

- [ ] **Step 2: Sanity check with impeccable**
```
/impeccable
```
Provide the three mockup HTML files for a quick comparative critique. Ask impeccable to evaluate against the brief: "cool party parents", "daytime club culture for families", "not soft community hub, not nightclub dark."

Specifically ask: which direction best telegraphs the tone in the first 3 seconds to a parent on their phone?

- [ ] **Step 3: Choose a direction**
Holly + Toby + group make the call. Document the decision:
```bash
echo "## Brand Decision — $(date +'%Y-%m-%d')
Direction chosen: [A/B/C or new direction name]
Rationale: [one sentence]
Key visual elements: [colours, marks, type approach]" >> projects/family-frequencies/docs/brand-decision.md
```

- [ ] **Step 4: Note the Daylight Disco existing artwork**
The existing Daylight Disco artwork (at `assets/daylight-disco-reference.png`) uses: playful black linework, halftone dots, yellow/blue accents. The chosen brand direction should feel like it *could* have produced this artwork. Use this as the sanity check.

---

### Task 2: Build the Daylight Disco event page with design-taste-frontend

One fast, mobile-first page. This is what gets shared to parents in the next 7 days.

- [ ] **Step 1: Define what the page needs (content brief)**
Before invoking the skill, write the content:
```
Event: Daylight Disco
Venue: Hide, Mt Maunganui
Date: Friday 4 July 2026
Time: 12pm – 6pm
Entry: Free, no booking required
What's on: Jazz house, kids boogie songs, face painting, toys, good times
Who: Parents + babies/toddlers, cool party parents energy
Contact/socials: [add if exists]
```

- [ ] **Step 2: Invoke design-taste-frontend**
```
/design-taste-frontend
```
Provide: the content brief above, the chosen brand direction (from Task 1), the Daylight Disco artwork as reference (the linework/halftone/yellow-blue palette), and the audience ("NZ parents on iPhones who want to know if this is their vibe in 5 seconds").

This skill builds or redesigns web UI — give it the content and brand direction, let it produce the page HTML.

- [ ] **Step 3: Review for tone**
Check: Does it read "cool party parents" or does it read "soft family community centre"? The test: would the person in the Daylight Disco artwork feel at home on this page?

Mobile check first — most parents will see this on their phone.

- [ ] **Step 4: Add Daylight Disco artwork**
The existing artwork goes in the hero or as a key visual. It's at `assets/daylight-disco-reference.png`.

- [ ] **Step 5: Save as the Daylight Disco page**
```bash
cp <generated-file> projects/family-frequencies/mockups/daylight-disco.html
```

- [ ] **Step 6: Deploy immediately**
Option 1 (fastest) — Vercel:
```bash
cd /Users/hollyread/Documents/holly-workspace/projects/family-frequencies
npx vercel --prod
```
Option 2 — Netlify drag-and-drop: drag the `mockups/` folder to netlify.com/drop.

Get the URL. That's what you share.

---

## Phase B — Brand assets with brandkit

Once brand direction is locked, generate a brand kit: logo concepts, colour palette cards, type specimens, and usage examples.

### Task 3: Generate brand kit with brandkit

- [ ] **Step 1: Prepare brand brief**
Write a 1-page brief:
```
Brand: Family Frequencies
Direction: [chosen from Task 1]
Audience: NZ parents, 28–40, culturally-engaged, not soft, "cool party parents"
Events: Daylight Disco, first aid courses, nutritionist talks, family gigs
Visual territory: [daytime club culture / community radio / gig crew — chosen direction]
Existing colours: [from chosen direction]
Existing type: [from chosen direction]
Reference: Daylight Disco artwork — linework, halftone, yellow/blue, playful but not childish
```

- [ ] **Step 2: Invoke brandkit**
```
/brandkit
```
Brandkit generates: logo system concepts, colour palette boards, type specimens, and usage examples. Provide the brief above.

- [ ] **Step 3: Iterate**
Brandkit is generative — expect 2–3 rounds of iteration. After each round, check: does this feel like something you'd see promoting a Saturday afternoon show at a cool Auckland or Tauranga venue?

- [ ] **Step 4: Export and save**
Save brand kit output to `projects/family-frequencies/assets/brand-kit/`.

- [ ] **Step 5: Lock the palette and type into the event page**
Take the confirmed palette and typography from the brand kit and update `daylight-disco.html` to match.

---

### Task 4: Rebuild the parent brand site with confirmed brand

Once brand is locked and event page is live, rebuild the full Family Frequencies site properly.

- [ ] **Step 1: Invoke design-taste-frontend for the full site**
```
/design-taste-frontend
```
Scope: Family Frequencies parent brand site with: home page (brand + upcoming events), Daylight Disco event page, and a simple "stay in the loop" email capture.

- [ ] **Step 2: Check against GSAP skills for event listing animations**
If the site has an events listing or calendar section, consider:
```
/gsap-scrolltrigger
```
Simple scroll-reveal on event cards. Nothing elaborate — one smooth entrance per card.

- [ ] **Step 3: Deploy**
```bash
npx vercel --prod
```

---

## Phase C — Event promotion content

Use video/motion skills to create shareable promotion for Daylight Disco.

### Task 5: Motion graphic for social sharing

A short looping visual for Instagram/Facebook. Playful, not corporate.

- [ ] **Step 1: Invoke motion-graphics**
```
/motion-graphics
```
Brief: "15-second animated announcement for Daylight Disco at Hide, Mt Maunganui, 27 June 2026, 12pm–6pm, free. Style: [chosen brand direction]. Elements: event name, venue, date, one punchy line (e.g. 'Bring the kids. Bring the vibe.'). No voiceover."

- [ ] **Step 2: Review the rendered MP4**
Check that it works muted (most social video autoplays muted). Key info should be readable in 3 seconds.

- [ ] **Step 3: Export formats**
The motion-graphics skill outputs an MP4. For Instagram Stories (9:16), ask for portrait orientation. For feed posts (1:1 or 4:5), ask for square.

---

### Task 6: Slideshow for event lineup / programme (optional, post-event)

After the first event, create a recap or programme card slideshow.

- [ ] **Step 1: Invoke slideshow**
```
/slideshow
```
Use for: event programme (what's on, what time), post-event recap (photos + highlights), or upcoming events announcement.

---

### Task 7: Faceless explainer for future programming (optional) ⚠️

For future events like first aid courses or nutritionist talks — a short explainer video explaining what the event is and why it matters.

**See Snyk note in memory before running.**

- [ ] **Step 1: Invoke faceless-explainer**
```
/faceless-explainer
```
Provide the topic (e.g. "Why we're running a baby first aid course for parents in Tauranga") and brief. The skill generates narration, audio, and typography-based visuals automatically.

- [ ] **Step 2: Use on social/website**
Short 30–60s explainers are perfect for Instagram Reels or embedding on the Family Frequencies website event page.

---

## Skill reference (quick-access)

| Skill | When | Priority |
|-------|------|----------|
| `/impeccable` | Brand direction decision + mockup review | Now |
| `/design-taste-frontend` | Daylight Disco event page | **URGENT — this week** |
| `/brandkit` | Brand kit generation once direction locked | This week |
| `/motion-graphics` | Social media announcement for Daylight Disco | This week |
| `/gsap-scrolltrigger` | Full brand site events section | After event |
| `/slideshow` | Event programme or recap | After event |
| `/high-end-visual-design` | Premium event poster or print materials | After event |
| `/faceless-explainer` ⚠️ | Future programming explainers | Later |
