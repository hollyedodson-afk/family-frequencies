# FF Content Factory — Renders + Copy Milestone (Plan 1 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One command turns a `cycle-plan.json` into on-brand, captioned still assets (PNG + caption text) in a local `out/` folder — proving the render + copy plumbing end-to-end.

**Architecture:** A Node/TypeScript CLI in `social-scheduler/factory/`. Four isolated units — `config`, `templates` (registry + `.dc.html`), `render-stills` (Playwright drives locked HTML templates → PNG), `write-copy` (Anthropic SDK → FF-voice captions) — wired by a thin `index.ts` orchestrator. Video (transcribe/clip) and publishing (Cloudinary/Sheet/Telegram) are Plan 2.

**Tech Stack:** Node 20+, TypeScript, Vitest (tests), Playwright (headless render), `@anthropic-ai/sdk` (captions), `zod` (input validation).

**Scope note:** This is Plan 1 of 2 (see `2026-07-06-ff-content-factory-design.md`). It produces working software on its own: branded stills + captions from a plan file. Plan 2 adds video + queue publishing.

---

## File Structure

```
social-scheduler/factory/
  ├─ package.json              # deps + scripts (test, factory)
  ├─ tsconfig.json
  ├─ vitest.config.ts
  ├─ .env.example              # ANTHROPIC_API_KEY, CLAUDE_MODEL
  ├─ .gitignore                # node_modules, out/, .env, work/
  ├─ README.md
  ├─ src/
  │   ├─ types.ts              # shared types + zod schemas
  │   ├─ config.ts             # env loading + validation
  │   ├─ templates.ts          # registry loader
  │   ├─ render-stills.ts      # Playwright → PNG
  │   ├─ write-copy.ts         # Anthropic → captions
  │   └─ index.ts              # CLI orchestrator
  ├─ templates/
  │   ├─ registry.json
  │   └─ date-card.dc.html     # first real on-brand template
  └─ test/
      ├─ types.test.ts
      ├─ config.test.ts
      ├─ templates.test.ts
      ├─ render-stills.test.ts
      ├─ write-copy.test.ts
      └─ fixtures/
          └─ cycle-plan.sample.json
```

---

## Task 1: Scaffold the factory project

**Files:**
- Create: `social-scheduler/factory/package.json`
- Create: `social-scheduler/factory/tsconfig.json`
- Create: `social-scheduler/factory/vitest.config.ts`
- Create: `social-scheduler/factory/.gitignore`
- Create: `social-scheduler/factory/.env.example`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "ff-content-factory",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "factory": "tsx src/index.ts"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.65.0",
    "dotenv": "^16.4.5",
    "playwright": "^1.48.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "@types/node": "^20.16.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"],
    "outDir": "dist"
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    testTimeout: 30000,
  },
});
```

- [ ] **Step 4: Create `.gitignore`**

```
node_modules/
dist/
out/
work/
.env
```

- [ ] **Step 5: Create `.env.example`**

```
ANTHROPIC_API_KEY=
CLAUDE_MODEL=claude-sonnet-4-6
```

- [ ] **Step 6: Install deps and Playwright's Chromium**

Run:
```bash
cd social-scheduler/factory && npm install && npx playwright install chromium
```
Expected: dependencies install; Chromium downloads without error.

- [ ] **Step 7: Verify the test runner works (no tests yet)**

Run: `cd social-scheduler/factory && npm test`
Expected: Vitest runs and reports "No test files found" (exit 0 or a clean "no tests" message).

- [ ] **Step 8: Commit**

```bash
git add social-scheduler/factory/package.json social-scheduler/factory/tsconfig.json social-scheduler/factory/vitest.config.ts social-scheduler/factory/.gitignore social-scheduler/factory/.env.example social-scheduler/factory/package-lock.json
git commit -m "chore(factory): scaffold Node/TS content factory project"
```

---

## Task 2: Shared types + input validation

**Files:**
- Create: `social-scheduler/factory/src/types.ts`
- Create: `social-scheduler/factory/test/types.test.ts`
- Create: `social-scheduler/factory/test/fixtures/cycle-plan.sample.json`

- [ ] **Step 1: Create the sample fixture `test/fixtures/cycle-plan.sample.json`**

```json
[
  {
    "recipe_id": "P1",
    "pillar": "promotion",
    "frame_or_painting": "painting",
    "type": "feed",
    "template": "date-card",
    "hook": "It's official — the next Daylight Disco has a date",
    "source": "render",
    "scheduled_at": "2026-07-20T09:00:00",
    "event_facts": { "date": "SAT 2 AUG", "venue": "HIDE, MT MAUNGANUI", "time": "12–5PM", "cost": "FREE" }
  }
]
```

- [ ] **Step 2: Write the failing test `test/types.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseCyclePlan } from "../src/types.ts";

describe("parseCyclePlan", () => {
  it("parses a valid plan file", () => {
    const raw = readFileSync("test/fixtures/cycle-plan.sample.json", "utf8");
    const plan = parseCyclePlan(JSON.parse(raw));
    expect(plan).toHaveLength(1);
    expect(plan[0].recipe_id).toBe("P1");
    expect(plan[0].frame_or_painting).toBe("painting");
    expect(plan[0].event_facts?.venue).toBe("HIDE, MT MAUNGANUI");
  });

  it("rejects an entry with an invalid source", () => {
    expect(() => parseCyclePlan([{ recipe_id: "X", pillar: "p", frame_or_painting: "frame", type: "feed", hook: "h", source: "banana", scheduled_at: "2026-07-20T09:00:00" }])).toThrow();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- types`
Expected: FAIL — `parseCyclePlan` not exported / module missing.

- [ ] **Step 4: Implement `src/types.ts`**

```typescript
import { z } from "zod";

export const EventFactsSchema = z.object({
  date: z.string(),
  venue: z.string(),
  time: z.string().optional(),
  cost: z.string().optional(),
});

export const CyclePlanEntrySchema = z.object({
  recipe_id: z.string(),
  pillar: z.string(),
  frame_or_painting: z.enum(["frame", "painting"]),
  type: z.enum(["feed", "story", "carousel", "reel"]),
  template: z.string().nullable().optional(),
  hook: z.string(),
  source: z.enum(["render", "clip", "footage"]),
  scheduled_at: z.string(),
  event_facts: EventFactsSchema.optional(),
});

export type EventFacts = z.infer<typeof EventFactsSchema>;
export type CyclePlanEntry = z.infer<typeof CyclePlanEntrySchema>;

export function parseCyclePlan(input: unknown): CyclePlanEntry[] {
  return z.array(CyclePlanEntrySchema).parse(input);
}

export interface CaptionSet {
  instagram: string;
  tiktok: string;
  facebook: string;
}

export interface RenderResult {
  recipe_id: string;
  pngPath: string;
  aspect: string;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- types`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add social-scheduler/factory/src/types.ts social-scheduler/factory/test/types.test.ts social-scheduler/factory/test/fixtures/cycle-plan.sample.json
git commit -m "feat(factory): shared types + cycle-plan validation"
```

---

## Task 3: Config loading

**Files:**
- Create: `social-scheduler/factory/src/config.ts`
- Create: `social-scheduler/factory/test/config.test.ts`

- [ ] **Step 1: Write the failing test `test/config.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/config.ts";

describe("loadConfig", () => {
  it("returns config when the API key is present", () => {
    const cfg = loadConfig({ ANTHROPIC_API_KEY: "sk-test", CLAUDE_MODEL: "claude-sonnet-4-6" });
    expect(cfg.anthropicApiKey).toBe("sk-test");
    expect(cfg.claudeModel).toBe("claude-sonnet-4-6");
  });

  it("defaults the model when unset", () => {
    const cfg = loadConfig({ ANTHROPIC_API_KEY: "sk-test" });
    expect(cfg.claudeModel).toBe("claude-sonnet-4-6");
  });

  it("throws a clear error when the API key is missing", () => {
    expect(() => loadConfig({})).toThrow(/ANTHROPIC_API_KEY/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- config`
Expected: FAIL — `loadConfig` not defined.

- [ ] **Step 3: Implement `src/config.ts`**

```typescript
export interface FactoryConfig {
  anthropicApiKey: string;
  claudeModel: string;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): FactoryConfig {
  const anthropicApiKey = env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set. Copy .env.example to .env and fill it in.");
  }
  return {
    anthropicApiKey,
    claudeModel: env.CLAUDE_MODEL || "claude-sonnet-4-6",
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- config`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add social-scheduler/factory/src/config.ts social-scheduler/factory/test/config.test.ts
git commit -m "feat(factory): env config loading with validation"
```

---

## Task 4: First on-brand template (`date-card.dc.html`) + registry

**Files:**
- Create: `social-scheduler/factory/templates/date-card.dc.html`
- Create: `social-scheduler/factory/templates/registry.json`

This template is self-contained: it reads data from URL query params and paints an on-brand P1 date card using the design-system tokens and the signature flat framed-poster (hard shadow drawn as a real offset element per the brand export note). 4:5 → 1080×1350.

- [ ] **Step 1: Create `templates/date-card.dc.html`**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800;900&display=swap');
  :root{
    --navy:#1A2B40; --cream:#FAF0E0; --gold:#F0B840; --rose:#E88070;
  }
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:1080px;height:1350px;background:var(--cream);font-family:'Barlow Condensed',sans-serif;}
  .stage{width:1080px;height:1350px;display:flex;align-items:center;justify-content:center;}
  .frame-wrap{position:relative;width:840px;height:1080px;}
  .frame-shadow{position:absolute;left:16px;top:16px;right:-16px;bottom:-16px;background:var(--gold);border-radius:20px;}
  .poster{position:relative;z-index:1;width:100%;height:100%;background:var(--navy);border:3px solid var(--navy);border-radius:20px;
    display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:64px 56px;color:var(--cream);text-align:center;}
  .eyebrow{font-size:22px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:var(--gold);}
  .logo{width:88px;height:88px;}
  .title{font-size:118px;font-weight:900;line-height:0.82;letter-spacing:-0.02em;text-transform:uppercase;}
  .title .accent{color:var(--rose);}
  .facts{display:flex;flex-direction:column;gap:14px;font-weight:700;}
  .facts .date{font-size:64px;font-weight:900;color:var(--gold);letter-spacing:-0.01em;}
  .facts .venue{font-size:34px;letter-spacing:0.04em;}
  .facts .time{font-size:30px;color:#B9C2CF;letter-spacing:0.06em;}
  .badge{display:inline-block;background:var(--rose);color:#5A2B25;font-size:26px;font-weight:800;letter-spacing:0.1em;
    text-transform:uppercase;padding:14px 34px;border-radius:9999px;}
</style>
</head>
<body>
  <div class="stage">
    <div class="frame-wrap">
      <div class="frame-shadow"></div>
      <div class="poster">
        <svg class="logo" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="13.5" r="6.5" fill="#F0B840"/>
          <path d="M3 33 C7 25 12 25 16 33 C20 41 28 41 32 33 C36 25 41 25 45 33" stroke="#FAF0E0" stroke-width="4" stroke-linecap="round"/>
        </svg>
        <div class="eyebrow">Family Frequencies presents</div>
        <div class="title">DAYLIGHT<br><span class="accent">DISCO</span></div>
        <div class="facts">
          <div class="date" id="f-date">SAT 2 AUG</div>
          <div class="venue" id="f-venue">HIDE, MT MAUNGANUI</div>
          <div class="time" id="f-time">12–5PM</div>
        </div>
        <div class="badge" id="f-cost">FREE · WALK-IN</div>
      </div>
    </div>
  </div>
  <script>
    const q = new URLSearchParams(location.search);
    const set = (id, key, fallback) => { const v = q.get(key); const el = document.getElementById(id); if (el) el.textContent = (v ?? fallback); };
    set('f-date','date','SAT 2 AUG');
    set('f-venue','venue','HIDE, MT MAUNGANUI');
    set('f-time','time','12–5PM');
    const cost = q.get('cost'); if (cost) document.getElementById('f-cost').textContent = cost + ' · WALK-IN';
    // Signal fonts are ready for the renderer to await.
    document.fonts.ready.then(() => { document.body.setAttribute('data-fonts-ready','1'); });
  </script>
</body>
</html>
```

- [ ] **Step 2: Create `templates/registry.json`**

```json
{
  "date-card": {
    "file": "date-card.dc.html",
    "fields": ["date", "venue", "time", "cost"],
    "type": "feed",
    "aspect": "4:5",
    "width": 1080,
    "height": 1350
  }
}
```

- [ ] **Step 3: Sanity-check the template renders (manual, optional)**

Run: `open "social-scheduler/factory/templates/date-card.dc.html?date=SAT%202%20AUG&venue=HIDE,%20MT%20MAUNGANUI&time=12%E2%80%935PM"`
Expected: a navy framed poster with gold hard-shadow, "DAYLIGHT DISCO" (DISCO in rose), the date facts, and a "FREE · WALK-IN" badge.

- [ ] **Step 4: Commit**

```bash
git add social-scheduler/factory/templates/date-card.dc.html social-scheduler/factory/templates/registry.json
git commit -m "feat(factory): first on-brand date-card template + registry"
```

---

## Task 5: Template registry loader

**Files:**
- Create: `social-scheduler/factory/src/templates.ts`
- Create: `social-scheduler/factory/test/templates.test.ts`

- [ ] **Step 1: Write the failing test `test/templates.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { loadRegistry, getTemplate } from "../src/templates.ts";

describe("template registry", () => {
  it("loads the registry and returns a known template spec", () => {
    const reg = loadRegistry();
    const spec = getTemplate(reg, "date-card");
    expect(spec.file).toBe("date-card.dc.html");
    expect(spec.width).toBe(1080);
    expect(spec.fields).toContain("venue");
  });

  it("throws for an unknown template key", () => {
    const reg = loadRegistry();
    expect(() => getTemplate(reg, "nope")).toThrow(/nope/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- templates`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `src/templates.ts`**

```typescript
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
export const TEMPLATES_DIR = join(here, "..", "templates");

export interface TemplateSpec {
  file: string;
  fields: string[];
  type: string;
  aspect: string;
  width: number;
  height: number;
}

export type Registry = Record<string, TemplateSpec>;

export function loadRegistry(dir: string = TEMPLATES_DIR): Registry {
  const raw = readFileSync(join(dir, "registry.json"), "utf8");
  return JSON.parse(raw) as Registry;
}

export function getTemplate(reg: Registry, key: string): TemplateSpec {
  const spec = reg[key];
  if (!spec) throw new Error(`Unknown template: ${key}`);
  return spec;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- templates`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add social-scheduler/factory/src/templates.ts social-scheduler/factory/test/templates.test.ts
git commit -m "feat(factory): template registry loader"
```

---

## Task 6: Render stills (Playwright → PNG) — first visible content

**Files:**
- Create: `social-scheduler/factory/src/render-stills.ts`
- Create: `social-scheduler/factory/test/render-stills.test.ts`

- [ ] **Step 1: Write the failing test `test/render-stills.test.ts`**

```typescript
import { describe, it, expect, afterAll } from "vitest";
import { existsSync, rmSync, statSync } from "node:fs";
import { renderStill } from "../src/render-stills.ts";
import { loadRegistry, getTemplate } from "../src/templates.ts";

const outDir = "test/.tmp-render";

describe("renderStill", () => {
  afterAll(() => { if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true }); });

  it("renders a date-card to a non-empty PNG", async () => {
    const spec = getTemplate(loadRegistry(), "date-card");
    const out = await renderStill({
      spec,
      data: { date: "SAT 2 AUG", venue: "HIDE, MT MAUNGANUI", time: "12–5PM", cost: "FREE" },
      outPath: `${outDir}/date-card.png`,
    });
    expect(existsSync(out)).toBe(true);
    expect(statSync(out).size).toBeGreaterThan(5000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- render-stills`
Expected: FAIL — `renderStill` not defined.

- [ ] **Step 3: Implement `src/render-stills.ts`**

```typescript
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { TEMPLATES_DIR, type TemplateSpec } from "./templates.ts";

export interface RenderStillArgs {
  spec: TemplateSpec;
  data: Record<string, string>;
  outPath: string;
}

export async function renderStill({ spec, data, outPath }: RenderStillArgs): Promise<string> {
  mkdirSync(dirname(outPath), { recursive: true });

  const fileUrl = pathToFileURL(join(TEMPLATES_DIR, spec.file));
  const params = new URLSearchParams();
  for (const key of spec.fields) {
    if (data[key] != null) params.set(key, data[key]);
  }
  fileUrl.search = params.toString();

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: spec.width, height: spec.height } });
    await page.goto(fileUrl.toString(), { waitUntil: "networkidle" });
    // Wait for webfonts so text/spacing don't reflow post-capture.
    await page.waitForFunction(() => document.body.getAttribute("data-fonts-ready") === "1", null, { timeout: 10000 }).catch(() => {});
    const abs = resolve(outPath);
    await page.screenshot({ path: abs, clip: { x: 0, y: 0, width: spec.width, height: spec.height } });
    return abs;
  } finally {
    await browser.close();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- render-stills`
Expected: PASS — a PNG >5KB is produced. (First real on-brand asset.)

- [ ] **Step 5: Commit**

```bash
git add social-scheduler/factory/src/render-stills.ts social-scheduler/factory/test/render-stills.test.ts
git commit -m "feat(factory): render on-brand stills via Playwright"
```

---

## Task 7: Write copy (Anthropic → FF-voice captions)

**Files:**
- Create: `social-scheduler/factory/src/write-copy.ts`
- Create: `social-scheduler/factory/test/write-copy.test.ts`

The unit takes a `CyclePlanEntry` + a "client caller" function (dependency-injected so tests don't hit the network) and returns a `CaptionSet`.

- [ ] **Step 1: Write the failing test `test/write-copy.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { buildCaptionPrompt, writeCopy } from "../src/write-copy.ts";
import type { CyclePlanEntry } from "../src/types.ts";

const entry: CyclePlanEntry = {
  recipe_id: "P1",
  pillar: "promotion",
  frame_or_painting: "painting",
  type: "feed",
  template: "date-card",
  hook: "It's official — the next Daylight Disco has a date",
  source: "render",
  scheduled_at: "2026-07-20T09:00:00",
  event_facts: { date: "SAT 2 AUG", venue: "HIDE, MT MAUNGANUI", time: "12–5PM", cost: "FREE" },
};

describe("write-copy", () => {
  it("builds a prompt that carries the hook, voice, and free/walk-in facts", () => {
    const p = buildCaptionPrompt(entry);
    expect(p).toContain("Daylight Disco");
    expect(p).toContain("free");
    expect(p).toMatch(/cool party parents|FF voice|Family Frequencies/i);
  });

  it("returns three platform captions via the injected caller", async () => {
    const fakeCaller = async () =>
      JSON.stringify({ instagram: "IG copy #DaylightDisco", tiktok: "TT copy", facebook: "FB copy" });
    const set = await writeCopy(entry, fakeCaller);
    expect(set.instagram).toContain("#DaylightDisco");
    expect(set.tiktok).toBe("TT copy");
    expect(set.facebook).toBe("FB copy");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- write-copy`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `src/write-copy.ts`**

```typescript
import Anthropic from "@anthropic-ai/sdk";
import type { CaptionSet, CyclePlanEntry } from "./types.ts";
import type { FactoryConfig } from "./config.ts";

const FF_VOICE = `You write social captions for Family Frequencies (FF), a parent brand running "daytime club culture for families" in Mt Maunganui / Tauranga, NZ. Daylight Disco is one offering: FREE, walk-in, no tickets. Voice: cool party parents — warm, a little cheeky, aesthetic-led, Kiwi, never twee, never corporate, never a council noticeboard. Short lines. Never invent ticket sales or urgency (events are free). Use 3–5 tight hashtags, always including #FamilyFrequencies and #DaylightDisco.`;

export function buildCaptionPrompt(entry: CyclePlanEntry): string {
  const facts = entry.event_facts
    ? `Event facts: ${entry.event_facts.date}, ${entry.event_facts.venue}, ${entry.event_facts.time ?? ""}, cost ${entry.event_facts.cost ?? "free"}.`
    : "No specific event facts.";
  return [
    FF_VOICE,
    `Pillar: ${entry.pillar}. Post type: ${entry.type}.`,
    `Hook (opening line / on-screen): "${entry.hook}".`,
    facts,
    `Write three captions for this post: one for Instagram (warm + a clear CTA), one for TikTok (keyword-y, casual, search-friendly — include plain terms like "family day out Mount Maunganui"), one for Facebook (community + mentions it's free/walk-in).`,
    `Return ONLY a JSON object with keys "instagram", "tiktok", "facebook" and string values. No markdown, no commentary.`,
  ].join("\n\n");
}

export type CaptionCaller = (prompt: string) => Promise<string>;

export function makeAnthropicCaller(cfg: FactoryConfig): CaptionCaller {
  const client = new Anthropic({ apiKey: cfg.anthropicApiKey });
  return async (prompt: string) => {
    const msg = await client.messages.create({
      model: cfg.claudeModel,
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });
    const block = msg.content.find((b) => b.type === "text");
    return block && block.type === "text" ? block.text : "{}";
  };
}

export async function writeCopy(entry: CyclePlanEntry, caller: CaptionCaller): Promise<CaptionSet> {
  const raw = await caller(buildCaptionPrompt(entry));
  const jsonStart = raw.indexOf("{");
  const jsonEnd = raw.lastIndexOf("}");
  const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as CaptionSet;
  return {
    instagram: parsed.instagram ?? "",
    tiktok: parsed.tiktok ?? "",
    facebook: parsed.facebook ?? "",
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- write-copy`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add social-scheduler/factory/src/write-copy.ts social-scheduler/factory/test/write-copy.test.ts
git commit -m "feat(factory): FF-voice caption generation via Anthropic"
```

---

## Task 8: CLI orchestrator (`index.ts`) — turn a plan into content

**Files:**
- Create: `social-scheduler/factory/src/index.ts`

The CLI: reads `--plan <file>`, renders each `source: "render"` entry's template to `out/<recipe_id>.png`, generates captions, and writes `out/index.json` mapping each recipe to its PNG + captions. Live Anthropic call (needs `.env`).

- [ ] **Step 1: Implement `src/index.ts`**

```typescript
import "dotenv/config";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { parseCyclePlan, type CaptionSet } from "./types.ts";
import { loadConfig } from "./config.ts";
import { loadRegistry, getTemplate } from "./templates.ts";
import { renderStill } from "./render-stills.ts";
import { writeCopy, makeAnthropicCaller } from "./write-copy.ts";

interface OutputRecord {
  recipe_id: string;
  type: string;
  pngPath: string | null;
  captions: CaptionSet | null;
  scheduled_at: string;
  errors: string[];
}

async function main() {
  const { values } = parseArgs({ options: { plan: { type: "string" }, out: { type: "string" } } });
  const planPath = values.plan;
  if (!planPath) throw new Error("Usage: npm run factory -- --plan <cycle-plan.json> [--out out]");
  const outDir = values.out ?? "out";
  mkdirSync(outDir, { recursive: true });

  const cfg = loadConfig();
  const registry = loadRegistry();
  const caller = makeAnthropicCaller(cfg);
  const plan = parseCyclePlan(JSON.parse(readFileSync(planPath, "utf8")));

  const results: OutputRecord[] = [];
  for (const entry of plan) {
    const rec: OutputRecord = { recipe_id: entry.recipe_id, type: entry.type, pngPath: null, captions: null, scheduled_at: entry.scheduled_at, errors: [] };

    if (entry.source === "render" && entry.template) {
      try {
        const spec = getTemplate(registry, entry.template);
        const data: Record<string, string> = {};
        if (entry.event_facts) {
          data.date = entry.event_facts.date;
          data.venue = entry.event_facts.venue;
          if (entry.event_facts.time) data.time = entry.event_facts.time;
          if (entry.event_facts.cost) data.cost = entry.event_facts.cost;
        }
        rec.pngPath = await renderStill({ spec, data, outPath: join(outDir, `${entry.recipe_id}.png`) });
      } catch (e) {
        rec.errors.push(`render: ${(e as Error).message}`);
      }
    } else {
      rec.errors.push(`skipped render: source=${entry.source} (video/footage is Plan 2)`);
    }

    try {
      rec.captions = await writeCopy(entry, caller);
    } catch (e) {
      rec.errors.push(`copy: ${(e as Error).message}`);
    }

    results.push(rec);
    console.log(`• ${entry.recipe_id}: ${rec.pngPath ? "png ✓" : "png –"} ${rec.captions ? "copy ✓" : "copy –"} ${rec.errors.length ? "(" + rec.errors.join("; ") + ")" : ""}`);
  }

  writeFileSync(join(outDir, "index.json"), JSON.stringify(results, null, 2));
  const ok = results.filter((r) => r.errors.length === 0).length;
  console.log(`\nDone: ${ok}/${results.length} clean. Assets in ${outDir}/`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Do a live end-to-end run (requires `.env` with a real key)**

Run:
```bash
cd social-scheduler/factory && cp -n .env.example .env
# edit .env to add ANTHROPIC_API_KEY, then:
npm run factory -- --plan test/fixtures/cycle-plan.sample.json
```
Expected: console shows `• P1: png ✓ copy ✓`; `out/P1.png` is an on-brand date card; `out/index.json` contains the three captions.

- [ ] **Step 3: Verify the outputs by eye**

Run: `open out/P1.png && cat out/index.json`
Expected: framed-poster date card looks on-brand; captions read in FF voice, free/walk-in, 3–5 hashtags, no fake urgency.

- [ ] **Step 4: Commit**

```bash
git add social-scheduler/factory/src/index.ts
git commit -m "feat(factory): CLI orchestrator — plan → stills + captions"
```

---

## Task 9: README + first-run docs

**Files:**
- Create: `social-scheduler/factory/README.md`

- [ ] **Step 1: Write `README.md`**

````markdown
# FF Content Factory

Turns a `cycle-plan.json` into on-brand, captioned assets. Plan 1 (this milestone): still renders + captions. Plan 2 (next): video clipping + queue publishing.

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
Outputs `out/<recipe_id>.png` + `out/index.json` (captions per platform).

## Add a template
1. Drop `<key>.dc.html` in `templates/` (reads data from URL query params; sets `data-fonts-ready` when webfonts load).
2. Add an entry to `templates/registry.json` (`file`, `fields`, `type`, `aspect`, `width`, `height`).
3. Reference it from a plan entry with `"source": "render", "template": "<key>"`.

## Test
```bash
npm test
```
````

- [ ] **Step 2: Run the full test suite**

Run: `cd social-scheduler/factory && npm test`
Expected: PASS — types, config, templates, render-stills, write-copy.

- [ ] **Step 3: Commit**

```bash
git add social-scheduler/factory/README.md
git commit -m "docs(factory): README + first-run instructions"
```

---

## Self-Review notes (author)

- **Spec coverage (Plan 1 scope):** config ✓ (Task 3), types/validation ✓ (Task 2), template registry + `.dc.html` reuse ✓ (Tasks 4–5), render stills via Playwright ✓ (Task 6), FF-voice captions via Claude ✓ (Task 7), CLI orchestrator ✓ (Task 8). Out of Plan 1 scope (→ Plan 2): Transcribe, Clip, Publish-to-queue (Cloudinary/Sheet/Telegram), idempotent `work/<run-id>` staging, Remotion motion.
- **Types consistent:** `CyclePlanEntry`, `CaptionSet`, `TemplateSpec`, `renderStill`, `writeCopy`, `makeAnthropicCaller`, `loadConfig`, `loadRegistry`/`getTemplate` used identically across tasks.
- **No placeholders:** every code/test/command step is concrete.

## Next: Plan 2 (video + publish) — build on ffmpeg

**Build-vs-adopt decision (revised 2026-07-10):** the earlier "adopt OpenCut AI" call is **invalidated** — scouting on 2026-07-10 found OpenCut has **no headless API** (UI-only; can't be driven from a pipeline). Postiz is inspiration-only; OpenStudio was rejected (MuAPI-locked UI shell). So Plan 2 builds the clipper ourselves on proven primitives: whisper.cpp for transcription, Claude for highlight selection, ffmpeg for cutting/reframing (9:16) and burning captions.

Plan 2 pipeline: Transcribe (whisper.cpp) → Clip (Claude picks highlights + ffmpeg cuts, 9:16 + burned captions) → Publish-to-queue (Cloudinary upload + write rows to the Google Sheet queue with `status: ready` + Telegram "batch ready") → idempotent `work/<run-id>` staging + run report. The branded-template renders stay Plan 1's. Written once Plan 1 renders content Holly's happy with.
