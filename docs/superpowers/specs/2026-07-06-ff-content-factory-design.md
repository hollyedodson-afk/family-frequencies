---
title: FF Content Factory — design spec
date: 2026-07-06
status: approved (design), pending implementation plan
owner: Holly
related:
  - docs/social/FF-Social-Strategy-90-Day-Calendar.md  (Pipeline A)
  - social-scheduler/  (consumer of factory output)
  - brand/family-frequencies-design-system/  (locked .dc.html templates)
---

# FF Content Factory — Design Spec

## 1. Purpose

Automate the boring production work around **real** Family Frequencies footage so a two-mama team can turn **one monthly shoot + a cycle plan** into a month of finished, on-brand, captioned social assets sitting in the existing scheduler queue, ready to approve.

This is **"Pipeline A"** from the social strategy doc. It *feeds* the existing `social-scheduler`; it does not replace it.

### Guiding principle
Automate production, **never fabricate content**. FF's advantage is that its footage is real families having a real good time. The factory clips, captions, brands, and copywrites around real footage — it never generates synthetic/AI-stock "family" media.

## 2. Goals / Non-goals

**Goals**
- One local command (`factory`) on batch day turns `footage/ + cycle-plan.json` into queue-ready assets + drafts.
- Output rows match the existing scheduler queue schema exactly — zero changes to the scheduler.
- Reuse the **locked `.dc.html` brand templates** for stills (no visual drift).
- On-brand by construction: framed-poster / Pacific Dusk / Barlow Condensed, or Daylight Disco artwork inside the FF frame, per the design system.
- Each stage is independently testable and the whole run is idempotent/resumable.

**Non-goals (v1)**
- No synthetic/AI-generated video or avatars.
- No changes to the scheduler UI or its n8n workflows (that's a separate sub-project).
- No always-on server / auto-trigger (runs locally, on demand).
- Not the DM-keyword→Kit or UGC-harvester automations (separate builds).

## 3. Decisions (resolved during brainstorming)

| Decision | Choice | Rationale |
|---|---|---|
| Build scope | Full factory (all six units), scoped v1 → v1.1 | Holly's call; architected in isolated units so it stays buildable incrementally |
| Runtime | **Local on Mac**, one command | Clipping/Whisper/rendering are heavy; free on her machine; fits once-a-month batching |
| Still rendering | **Reuse locked `.dc.html` templates via headless Playwright** | Templates already on-brand, reviewed, with working PNG export; avoids drift + re-authoring |
| Captioned clips | **ffmpeg + Whisper subtitles** (no Remotion) | Simple burn-in; Remotion overkill for captioned real footage |
| Designed motion | **Remotion**, optional/light in v1.1 | Only where real animation earns it (animated lower-thirds/kinetic covers) |
| Language | **Node / TypeScript** in `social-scheduler/factory/` | Playwright, Remotion, Cloudinary, Anthropic SDK are first-class in Node; dashboard/watchdog already Node. Whisper + ffmpeg called as subprocesses. (Consciously bends the workspace "Python backend" convention because the render tools dictate Node — approved.) |
| Template set | **Data-driven registry**; ship a starter set, finalise after first render review | Holly wants to see them rendered before committing to the exact list |
| LLM | Claude via Anthropic SDK — Sonnet for captions/highlight-picking (cost/quality balance); model id in config | Voice quality matters; keep it swappable |

## 4. Architecture — six isolated units

Each unit: one purpose, well-defined input→output, testable alone.

| # | Unit | Input | Output | Tool |
|---|---|---|---|---|
| 1 | **Ingest** | `footage/` folder + `cycle-plan.json` | normalised job list (clips to cut, stills to render, captions to write) | fs scan + plan parse |
| 2 | **Transcribe** | long event videos | transcript + word-level timestamps (JSON) | `whisper.cpp` (Mac-native, subprocess) |
| 3 | **Clip** | transcript + scene changes + job list | 15–20 highlight windows → 9:16 clips with burned captions | Claude picks highlight windows → `ffmpeg` cuts/crops/subtitles |
| 4 | **Render stills** | queue rows needing graphics + template registry | on-brand PNGs (covers, carousels, song-cards, date cards) | Playwright drives locked `.dc.html` templates → PNG |
| 5 | **Write copy** | recipe (hook + pillar + event facts) | IG / TikTok / FB captions in FF voice | Claude (Anthropic SDK) |
| 6 | **Publish-to-queue** | finished assets + captions | Cloudinary upload + queue rows (`status: ready`) + Telegram ping | Cloudinary SDK + queue writer |

### Data flow
```
footage/ + cycle-plan.json
   → [1 Ingest] → [2 Transcribe] → [3 Clip] ─┐
   → [4 Render stills] ───────────────────────┼→ [5 Write copy] → [6 Publish-to-queue]
                                               │
     assets → Cloudinary ; rows → social-scheduler queue (status: ready)
                                               → Telegram: "Batch ready: N posts to approve"
```

## 5. Interfaces / contracts

### 5.1 Input — `cycle-plan.json`
The cycle's grid from the strategy doc, one entry per intended post:
```json
[
  {
    "recipe_id": "C1",
    "pillar": "community",
    "frame_or_painting": "painting",
    "type": "reel",
    "template": null,
    "hook": "POV: you told your toddler you're going to a disco",
    "source": "clip",
    "scheduled_at": "2026-07-13T09:00:00",
    "event_facts": { "date": "TBC", "venue": "Hide, Mt Maunganui", "cost": "free" }
  },
  {
    "recipe_id": "ED1",
    "pillar": "education",
    "frame_or_painting": "frame",
    "type": "carousel",
    "template": "song-card",
    "hook": "Save this: 10 songs that turn any lounge into a disco",
    "source": "render",
    "scheduled_at": "2026-07-08T09:00:00"
  }
]
```
`source: "clip"` → produced by units 2–3. `source: "render"` → produced by unit 4. `source: "footage"` → a hand-picked clip just needs captions + copy.

### 5.2 Output — scheduler queue row (unchanged existing schema)
```json
{
  "id": "ff-20260713-c1",
  "type": "reel",
  "caption": "…FF-voice caption with 3–5 hashtags…",
  "scheduled_at": "2026-07-13T09:00:00",
  "needs_music": "TRUE",
  "notes": "C1 supercut — add trending audio before posting",
  "status": "ready",
  "media_url": "https://res.cloudinary.com/…/c1-supercut.mp4"
}
```
Written to the same queue store the scheduler reads (JSON file / Sheet — matched to current `social-scheduler` config at implementation time).

### 5.3 Template registry (data-driven)
`factory/templates/registry.json` maps a template key → its `.dc.html` file + the data fields it expects + output type/aspect:
```json
{
  "song-card":   { "file": "song-card.dc.html",   "fields": ["title","artist","index"], "type": "carousel", "aspect": "4:5" },
  "date-card":   { "file": "date-card.dc.html",    "fields": ["date","venue","time"],    "type": "feed",     "aspect": "4:5" },
  "photo-frame": { "file": "photo-frame.dc.html",  "fields": ["photo"],                  "type": "carousel", "aspect": "4:5" },
  "supercut-cover": { "file": "supercut-cover.dc.html", "fields": ["headline","still"],  "type": "cover",    "aspect": "9:16" }
}
```
Adding/removing a template = editing this file + dropping a `.dc.html` in `factory/templates/`. **The v1 starter set is provisional; final set chosen after Holly reviews first renders.**

## 6. Runtime & layout

```
social-scheduler/factory/
  ├─ src/
  │   ├─ index.ts            # CLI entry: `factory --plan cycle-plan.json --footage ./footage`
  │   ├─ ingest.ts           # unit 1
  │   ├─ transcribe.ts       # unit 2 (whisper.cpp subprocess)
  │   ├─ clip.ts             # unit 3 (Claude highlights + ffmpeg)
  │   ├─ render-stills.ts    # unit 4 (Playwright + .dc.html)
  │   ├─ write-copy.ts       # unit 5 (Anthropic SDK)
  │   ├─ publish.ts          # unit 6 (Cloudinary + queue writer + Telegram)
  │   ├─ config.ts           # loads .env
  │   └─ types.ts
  ├─ templates/              # .dc.html + registry.json
  ├─ work/<run-id>/          # staging (gitignored)
  ├─ test/                   # fixture-based unit tests
  ├─ package.json
  └─ README.md
```
- CLI: `npm run factory -- --plan ./cycle-plan.json --footage ./footage`
- External deps (Mac): `whisper.cpp` and `ffmpeg` via Homebrew; documented in README + checked at startup with a friendly error if missing.

## 7. Config & secrets
`.env` (gitignored) + `.env.example` with empty keys:
`ANTHROPIC_API_KEY`, `CLOUDINARY_URL` (or cloud/key/secret), `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `CLAUDE_MODEL` (default a Sonnet id), `QUEUE_PATH` (path/URL of the scheduler queue store). No secrets in code or logs.

## 8. Error handling & idempotency
- Every unit stages output under `work/<run-id>/` and is **resumable**: re-running skips artefacts already produced (keyed by `recipe_id`). A failure on post 12 doesn't redo the first 11.
- **Nothing hits the live queue until a run fully succeeds** — assets are staged, then committed to Cloudinary + queue as the final step (all-or-nothing per run).
- Missing external binary (whisper/ffmpeg) → clear startup error with the `brew install` command.
- A per-run **report** (made / skipped / failed, with reasons) prints to console and pings Telegram.

## 9. Testing
- Fixture-based unit test per unit: a short sample clip + a sample `cycle-plan.json` row, asserting each unit's output shape (transcript JSON, clip file exists + is 9:16, PNG exists + correct dims, caption non-empty + has hashtags, queue row matches schema).
- One end-to-end smoke test on a ~30s fixture video producing one clip + one still + one caption → one staged queue row.
- Follows TDD where practical (test the contract of each unit before wiring internals).

## 10. Scope: v1 vs v1.1
**v1 (core plumbing, end-to-end):** all six units wired; Clip uses a simple highlight heuristic (transcript energy + scene cuts, light Claude assist); stills cover the provisional starter set (supercut-cover, photo-frame, song-card, date-card); motion = none; local CLI; idempotent runs; Telegram report.

**v1.1:** smarter Claude-driven highlight selection; expanded template set (finalised after review); Remotion animated lower-thirds/kinetic covers; optional n8n glue to move finished assets and ping without a manual command.

## 11. Open items (resolve at implementation)
- Exact queue store the current `social-scheduler` reads in production (JSON file vs Google Sheet) — confirm and point `QUEUE_PATH` at it.
- Which `.dc.html` templates already exist vs need creating for the starter set (some like the "what to expect" carousel exist; song/date/photo-frame/supercut-cover may need authoring from existing components).
- Whisper model size (accuracy vs speed on Mac) — pick during Transcribe implementation.
