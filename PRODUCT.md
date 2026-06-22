# Family Frequencies — Product Brief

**Date:** 2026-06-21
**Status:** Active — website not yet built, brand locked

---

## What It Is

Family Frequencies is a family-friendly events and community brand based in Mt Maunganui / Tauranga, NZ, run by Holly, Toby, and friends. It is not a venue, not a club, and not a parenting group — it sits in the space of **daytime club culture for families**: the aesthetic and energy of a good party, made accessible to people who have kids in tow.

The website is the public home for the brand. Its job is to tell people what's on, where, and when — and to make Family Frequencies feel like something worth following.

---

## Who It's For

**Primary:** Parents in the Bay of Plenty with kids 0–5 who still want to have a good time and aren't looking for soft-play. They follow things on Instagram before they check a website. They trust word of mouth and aesthetic.

**Secondary:** Older kids, carers, and the friends-without-kids who come along anyway.

**Tone:** Cool party parents. Not a local council noticeboard. Not a mum-and-baby class. Not a nightclub.

---

## Business Goals

1. Be the digital home for Family Frequencies events — a permanent, linkable URL people can send to each other.
2. Build credibility so local venues and businesses see FF as worth working with.
3. Make it easy to get event info without a booking system (events are free and walk-in).
4. Lay the infrastructure for a mailing list or social following over time.
5. Be extensible — the brand will hold multiple event types (discos, workshops, talks, gigs); the site architecture should support that.

---

## First Event: Daylight Disco

- **Date:** 4 July 2026
- **Venue:** Hide, Mt Maunganui
- **Time:** 12pm–6pm
- **Cost:** Free
- **Booking:** Not required (walk-in)
- **Music/vibe:** Jazz house, kids boogie songs, face painting, toys, good times
- **Existing artwork:** Illustrated black linework poster with halftone dots, yellow/blue accents, parents and babies DJing. This artwork is the first event sub-brand and is already locked in — it does not change to match the parent palette.

The first version of the website is essentially a Daylight Disco landing page with a Family Frequencies header. Everything else is future scope.

---

## Broader Event Programme (future)

Family Frequencies is a container for multiple event types under one brand:

- **Daylight Disco** — music, dancing, face painting, daytime social
- **First Aid Courses** — practical skill-building for parents
- **Nutritionist Talks** — expert-led, relaxed format
- **Family-Friendly Gigs** — ticketed or free live music with kids welcome
- **Workshops** — TBD

The site should be built so adding a new event type doesn't require rethinking the structure.

---

## Website Goals (v1)

**Must have:**
- Daylight Disco event page with date, venue, time, and what to expect
- Clear Family Frequencies header so people know who's putting it on
- Mobile-first — the audience will find this via Instagram on their phone
- Share-friendly — works well when linked in Stories or a bio link

**Nice to have:**
- A short brand/about section explaining what Family Frequencies is
- Email capture (Mailchimp or similar) for future event announcements
- A placeholder "more coming soon" section for future events

**Out of scope for v1:**
- Booking or ticket flows (events are free, walk-in)
- User accounts
- CMS / content management (static HTML or simple framework is fine)
- Photography (no photos exist yet; event uses illustration)
- Animation / motion

---

## Design Direction

**Parent brand (Family Frequencies):**
- Palette: Navy `#1A2B40`, Cream `#FAF0E0`, Gold `#F0B840`, Rose `#E88070`
- Symbol: Three-arc wave mark (ocean swell + sound frequencies + community ripple)
- Type: Barlow Condensed, bold, all caps, stacked wordmark
- Character: Confident, grown-up, steady — the frame, not the painting

**Daylight Disco sub-brand:**
- Illustrated artwork already exists (locked in)
- Black linework, halftone dots, yellow and blue accents
- Brighter and more expressive than the parent palette — intentionally
- Parent brand appears as: header above event content + event stamp on poster

**Layout:**
- Horizontal logo lockup in site header
- Event card/section uses the event's own artwork and colour
- Footer: symbol only or small stacked lockup
- No dark primary mode — the parent brand is daytime and coastal

---

## Tech Approach

The v1 website is a **static site** — no backend, no database, no framework requirements. Priority order:

1. Plain HTML/CSS/JS (fastest to ship, easiest to maintain, no build step)
2. Astro or similar static site generator if templating becomes necessary for multiple events
3. No React, no SPA — there's no interactive complexity that warrants it

Hosting: Vercel (consistent with Holly's other projects, free tier is fine).

Domain: TBD — familyfrequencies.co.nz or similar.

---

## Measures of Success

- Someone can share the link on Instagram Stories and a stranger can find out everything they need to know about Daylight Disco in under 30 seconds
- Holly and Toby don't need to answer "where is it / what time / do I need to book?" in DMs after the site is live
- The site looks like it belongs to the same brand as the Daylight Disco poster
- It works on a phone without horizontal scroll or broken layout

---

## What This Is Not

- A ticketing platform
- A community forum or Facebook Group replacement
- A parenting resource or advice site
- A commercial venue website
- Something that needs to be perfect before Daylight Disco — a good v1 beats a great v2 that isn't built yet

---

## Open Questions

- Domain name confirmed? (familyfrequencies.co.nz vs .nz vs .com)
- Mailing list provider preference? (Mailchimp, Kit, Beehiiv)
- Any copy/text already written for the Daylight Disco page, or does this need to be drafted?
- Is there a full-resolution version of the Daylight Disco artwork for web use, or just the reference PNG in `/assets/`?
