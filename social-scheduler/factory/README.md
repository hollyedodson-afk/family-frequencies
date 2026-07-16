# FF Content Factory

Turns a `cycle-plan.json` into on-brand, captioned assets for the FF social scheduler.

- **Plan 1:** on-brand still renders + FF-voice captions.
- **Plan 2 (shipped):** video clipping + burned subtitles, hand-built on whisper.cpp + ffmpeg
  (OpenCut AI was evaluated and rejected — no headless API) + Cloudinary/Sheet/Telegram publishing.

## Setup
```bash
cd social-scheduler/factory
npm install && npx playwright install chromium
cp .env.example .env    # add ANTHROPIC_API_KEY
```

## Run
```bash
npm run factory -- --plan test/fixtures/cycle-plan.sample.json
```
Outputs:
- `out/<recipe_id>.png` — on-brand rendered stills
- `out/index.json` — per-post captions (instagram / tiktok / facebook) + render paths + any per-entry errors

Each entry's render and caption run in their own try/catch, so one failure never aborts the batch — failures are recorded in `index.json` and the run continues.

## Add a template
1. Drop `<key>.dc.html` in `templates/`. It must read its data from URL query params and set `document.body[data-fonts-ready="1"]` once webfonts load (see `date-card.dc.html`).
2. Add an entry to `templates/registry.json`: `file`, `fields`, `type`, `aspect`, `width`, `height`.
3. Reference it from a plan entry: `"source": "render", "template": "<key>"`.

## Quality gates
Before calling any change done, all of these must be clean (see `BUGS.md` for the register):
```bash
npm test            # unit + Playwright render tests
npx tsc --noEmit    # types
npm audit           # 0 vulnerabilities
```

## Layout
```
src/            types · config · templates · render-stills · write-copy · index (CLI)
templates/      registry.json + <key>.dc.html on-brand templates
test/           vitest specs + fixtures
BUGS.md         issue register (must be clear before "done")
```

## Video pipeline setup (Plan 2)

One-time, on the Mac that runs batches:

    brew install whisper-cpp
    brew install ffmpeg-full     # IMPORTANT: needs a libass-enabled ffmpeg for burned captions.
                                 # The default `brew install ffmpeg` on some machines is built
                                 # WITHOUT libass — the `subtitles` filter is then missing and
                                 # clip caption burn-in fails. Verify with:
                                 #   ffmpeg -filters | grep subtitles
    npm run setup:whisper        # downloads ggml-base.en.bin (~142MB) into models/

Fill the new `.env` keys (values live in the repo root `.env`): `CLOUDINARY_CLOUD_NAME`,
`CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.

## Batch day

    npm run factory -- --plan cycle-plan.json --footage ./footage

- `source: "render"` entries → Plan 1 stills; `"clip"` → best highlight cut from the
  biggest video in `footage/`; `"footage"` → the file named in `footage_file`, captioned whole.
- Everything stages under `work/<run-id>/` (default run-id = today's date). A failed run
  publishes NOTHING; fix and re-run with `--run-id <same>` — finished items are skipped.
- On success every asset uploads to Cloudinary and lands in the scheduler queue as a
  **draft** via the WF01 webhook — each one pings Telegram; reply APPROVE to schedule.
- `--no-publish` stages everything but touches nothing live.
