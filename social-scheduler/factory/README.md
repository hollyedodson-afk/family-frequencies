# FF Content Factory

Turns a `cycle-plan.json` into on-brand, captioned assets for the FF social scheduler.

- **Plan 1 (this milestone):** on-brand still renders + FF-voice captions.
- **Plan 2 (next):** video clipping + subtitles (adopt [OpenCut AI](https://github.com/Ekaanth/OpenCut-AI), not hand-built) + Cloudinary/Sheet/Telegram publishing.

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
