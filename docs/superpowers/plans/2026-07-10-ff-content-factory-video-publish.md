# FF Content Factory — Plan 2: Video + Publish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn event footage into captioned 9:16 clips and push finished assets (clips + Plan 1 stills) into the live scheduler queue via Cloudinary + the WF01 submit webhook, with idempotent `work/<run-id>` staging.

**Architecture:** Four new units on top of Plan 1's factory (`social-scheduler/factory/`): **Transcribe** (whisper.cpp subprocess → segment JSON), **Clip** (Claude picks highlight windows → ffmpeg cuts/crops 9:16 + burns SRT subtitles), **Publish** (Cloudinary upload → `POST /webhook/ff-submit-post` → Telegram batch summary), and **Staging** (`work/<run-id>/`, artefacts keyed by `recipe_id`, re-runs skip finished work; nothing hits the queue until every asset staged cleanly). All subprocess/network calls are injected so every unit tests offline.

**Tech Stack:** Node 20+ / TypeScript (existing factory package), vitest 4, zod, `@anthropic-ai/sdk` (existing), `cloudinary` v2 SDK (new dep), `whisper-cpp` + `ffmpeg` via Homebrew (subprocesses), native `fetch` for webhook + Telegram.

**Build-vs-adopt note (2026-07-10):** OpenCut AI was rejected — no headless API (UI-only). Postiz inspiration-only; OpenStudio rejected (MuAPI-locked shell). We build on whisper.cpp + ffmpeg exactly as the original design spec (`docs/superpowers/specs/2026-07-06-ff-content-factory-design.md`) specified.

**Spec deviation (deliberate):** the design spec said queue rows land with `status: ready`. The live scheduler's actual flow is WF01 submit webhook → row `status: draft` → Telegram "New draft!" → Holly replies APPROVE → `scheduled`. We publish through WF01 (`https://n8n-production-4a398.up.railway.app/webhook/ff-submit-post`) so every factory asset gets the existing approval + Telegram-reply machinery for free, and zero scheduler changes are needed. "Batch ready to approve" is exactly the design's intent.

**Existing contracts to reuse (from Plan 1 — do not redefine):**
- `CyclePlanEntry`, `EventFacts`, `CaptionSet`, `parseCyclePlan` in `src/types.ts`
- `FactoryConfig`, `loadConfig` in `src/config.ts`
- `writeCopy(entry, caller)`, `makeAnthropicCaller(cfg)`, `CaptionCaller` in `src/write-copy.ts`
- `renderStill({spec, data, outPath})` in `src/render-stills.ts`; `loadRegistry`/`getTemplate` in `src/templates.ts`
- CLI entry `src/index.ts` (`npm run factory -- --plan <file>`)

**External binaries (Mac, checked at startup):** `ffmpeg` (already installed, 8.1.2) and `whisper-cli` (from `brew install whisper-cpp` — NOT yet installed on Holly's machine). Whisper model file downloaded once to `models/ggml-base.en.bin` (gitignored).

**All work happens in** `social-scheduler/factory/` unless a path says otherwise. Run all commands from that directory.

---

## File structure

| File | Responsibility |
|---|---|
| Create `src/tools.ts` | Preflight: assert ffmpeg + whisper-cli exist, friendly brew-install errors |
| Modify `src/types.ts` | Add `footage_file` to plan entry; add `TranscriptSegment`, `HighlightWindow`, `QueueSubmission`, `RunReport` types |
| Create `src/staging.ts` | `work/<run-id>/` layout, artefact paths per recipe, done-markers, resumability |
| Create `src/transcribe.ts` | ffmpeg audio-extract + whisper-cli subprocess → `TranscriptSegment[]` |
| Create `src/highlights.ts` | Claude highlight-window selection from transcript (prompt + strict JSON parse/validate) |
| Create `src/clip.ts` | SRT generation + ffmpeg arg-building + cut/crop/burn execution |
| Create `src/publish.ts` | Cloudinary upload, WF01 webhook submission, Telegram batch summary |
| Modify `src/config.ts` | Add Cloudinary / webhook / Telegram / whisper-model config keys |
| Modify `src/index.ts` | Orchestrate: staging + clip pipeline + publish gate + run report |
| Modify `.env.example`, `.gitignore`, `README.md` | New keys, `work/` + `models/` ignore, setup docs |
| Test files | `test/tools.test.ts`, `test/staging.test.ts`, `test/transcribe.test.ts`, `test/highlights.test.ts`, `test/clip.test.ts`, `test/publish.test.ts` + fixtures |

---

### Task 1: Tool preflight (`src/tools.ts`)

**Files:**
- Create: `src/tools.ts`
- Test: `test/tools.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// test/tools.test.ts
import { describe, it, expect } from "vitest";
import { assertToolsAvailable } from "../src/tools.ts";

describe("assertToolsAvailable", () => {
  it("passes when every binary resolves", () => {
    const which = (_bin: string) => true;
    expect(() => assertToolsAvailable(["ffmpeg", "whisper-cli"], which)).not.toThrow();
  });

  it("throws a brew-install hint naming every missing binary", () => {
    const which = (bin: string) => bin === "ffmpeg";
    expect(() => assertToolsAvailable(["ffmpeg", "whisper-cli"], which)).toThrow(
      /whisper-cli.*brew install whisper-cpp/s,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/tools.test.ts`
Expected: FAIL — `Cannot find module '../src/tools.ts'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/tools.ts
import { spawnSync } from "node:child_process";

const INSTALL_HINTS: Record<string, string> = {
  ffmpeg: "brew install ffmpeg",
  "whisper-cli": "brew install whisper-cpp",
};

export type WhichFn = (bin: string) => boolean;

export const defaultWhich: WhichFn = (bin) =>
  spawnSync("which", [bin], { stdio: "ignore" }).status === 0;

export function assertToolsAvailable(bins: string[], which: WhichFn = defaultWhich): void {
  const missing = bins.filter((b) => !which(b));
  if (missing.length === 0) return;
  const lines = missing.map((b) => `  ${b} — install with: ${INSTALL_HINTS[b] ?? `brew install ${b}`}`);
  throw new Error(`Missing required tools:\n${lines.join("\n")}`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/tools.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/tools.ts test/tools.test.ts
git commit -m "feat(factory): tool preflight with brew-install hints"
```

---

### Task 2: Plan-2 types (`src/types.ts`)

**Files:**
- Modify: `src/types.ts`
- Test: `test/types.test.ts` (append)

- [ ] **Step 1: Write the failing tests** — append to `test/types.test.ts`:

```typescript
import { HighlightWindowSchema, parseHighlightWindows } from "../src/types.ts";

describe("footage_file on plan entries", () => {
  it("accepts an entry with footage_file", () => {
    const entry = {
      recipe_id: "C2", pillar: "community", frame_or_painting: "painting",
      type: "reel", hook: "h", source: "footage",
      scheduled_at: "2026-07-13T09:00:00", footage_file: "clips/hand-picked.mp4",
    };
    expect(parseCyclePlan([entry])[0].footage_file).toBe("clips/hand-picked.mp4");
  });
});

describe("parseHighlightWindows", () => {
  it("parses valid windows", () => {
    const w = parseHighlightWindows([{ start_ms: 1000, end_ms: 12000, reason: "big laugh" }], 60000);
    expect(w).toHaveLength(1);
  });

  it("rejects a window that ends past the video duration", () => {
    expect(() =>
      parseHighlightWindows([{ start_ms: 55000, end_ms: 70000, reason: "x" }], 60000),
    ).toThrow(/duration/);
  });

  it("rejects a window where start >= end", () => {
    expect(() =>
      parseHighlightWindows([{ start_ms: 9000, end_ms: 9000, reason: "x" }], 60000),
    ).toThrow();
  });
});
```

(Note: `describe`, `it`, `expect`, `parseCyclePlan` are already imported in this file from Plan 1.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/types.test.ts`
Expected: FAIL — `parseHighlightWindows` not exported

- [ ] **Step 3: Implement** — in `src/types.ts`:

Add `footage_file` to `CyclePlanEntrySchema` (after `scheduled_at`):

```typescript
  footage_file: z.string().optional(),
```

Append at the end of the file:

```typescript
export interface TranscriptSegment {
  start_ms: number;
  end_ms: number;
  text: string;
}

export const HighlightWindowSchema = z
  .object({
    start_ms: z.number().int().nonnegative(),
    end_ms: z.number().int().positive(),
    reason: z.string(),
  })
  .refine((w) => w.end_ms > w.start_ms, { message: "end_ms must be after start_ms" });

export type HighlightWindow = z.infer<typeof HighlightWindowSchema>;

export function parseHighlightWindows(input: unknown, durationMs: number): HighlightWindow[] {
  const windows = z.array(HighlightWindowSchema).parse(input);
  for (const w of windows) {
    if (w.end_ms > durationMs) {
      throw new Error(`highlight window ${w.start_ms}–${w.end_ms}ms exceeds video duration ${durationMs}ms`);
    }
  }
  return windows;
}

/** Body accepted by WF01 ff-submit-post webhook. Row lands as status=draft. */
export interface QueueSubmission {
  type: string;
  caption: string;
  media_url: string;
  scheduled_at: string;
  needs_music: boolean;
  notes: string;
}

export interface RunReportItem {
  recipe_id: string;
  asset: string | null;        // staged local path
  media_url: string | null;    // Cloudinary URL after publish
  published: boolean;
  skipped: boolean;            // already staged by a previous run
  errors: string[];
}

export interface RunReport {
  run_id: string;
  items: RunReportItem[];
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/types.test.ts`
Expected: PASS (all, including Plan 1's existing type tests)

- [ ] **Step 5: Commit**

```bash
git add src/types.ts test/types.test.ts
git commit -m "feat(factory): Plan-2 types — footage_file, highlight windows, queue submission, run report"
```

---

### Task 3: Run staging (`src/staging.ts`)

**Files:**
- Create: `src/staging.ts`
- Test: `test/staging.test.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Write the failing test**

```typescript
// test/staging.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Staging } from "../src/staging.ts";

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "ff-staging-")); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

describe("Staging", () => {
  it("creates the run directory tree", () => {
    const s = new Staging(root, "2026-07-13-a");
    expect(existsSync(join(root, "2026-07-13-a", "clips"))).toBe(true);
    expect(existsSync(join(root, "2026-07-13-a", "stills"))).toBe(true);
    expect(existsSync(join(root, "2026-07-13-a", "captions"))).toBe(true);
    expect(existsSync(join(root, "2026-07-13-a", "transcripts"))).toBe(true);
  });

  it("isDone is false until markDone, then true, and survives a new instance", () => {
    const s = new Staging(root, "run1");
    expect(s.isDone("C1", "clip")).toBe(false);
    writeFileSync(s.path("clips", "C1.mp4"), "fake");
    s.markDone("C1", "clip");
    expect(s.isDone("C1", "clip")).toBe(true);
    const s2 = new Staging(root, "run1");
    expect(s2.isDone("C1", "clip")).toBe(true);
  });

  it("path() returns paths inside the run dir", () => {
    const s = new Staging(root, "run1");
    expect(s.path("clips", "C1.mp4")).toBe(join(root, "run1", "clips", "C1.mp4"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/staging.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```typescript
// src/staging.ts
import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SUBDIRS = ["clips", "stills", "captions", "transcripts", "done"] as const;
type Subdir = (typeof SUBDIRS)[number];

/**
 * work/<run-id>/ staging. Artefacts are keyed by recipe_id + stage; a
 * `done/<recipe>.<stage>` marker means that artefact is complete, so re-runs
 * skip it. Nothing in here is ever the live queue — publish reads from it.
 */
export class Staging {
  readonly dir: string;

  constructor(workRoot: string, runId: string) {
    this.dir = join(workRoot, runId);
    for (const d of SUBDIRS) mkdirSync(join(this.dir, d), { recursive: true });
  }

  path(sub: Subdir, file: string): string {
    return join(this.dir, sub, file);
  }

  isDone(recipeId: string, stage: string): boolean {
    return existsSync(this.markerPath(recipeId, stage));
  }

  markDone(recipeId: string, stage: string): void {
    writeFileSync(this.markerPath(recipeId, stage), new Date().toISOString());
  }

  private markerPath(recipeId: string, stage: string): string {
    return join(this.dir, "done", `${recipeId}.${stage}`);
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/staging.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Add `work/` and `models/` to `.gitignore`** — append these lines to `social-scheduler/factory/.gitignore`:

```
work/
models/
```

- [ ] **Step 6: Commit**

```bash
git add src/staging.ts test/staging.test.ts .gitignore
git commit -m "feat(factory): idempotent work/<run-id> staging with done-markers"
```

---

### Task 4: Transcribe (`src/transcribe.ts`)

whisper-cli needs 16kHz mono WAV, so transcription is two subprocess steps: ffmpeg audio-extract, then whisper with JSON output (`-oj`). Both run through an injected `runner` so tests never spawn real processes.

**Files:**
- Create: `src/transcribe.ts`
- Test: `test/transcribe.test.ts`
- Create: `test/fixtures/whisper-output.sample.json`

- [ ] **Step 1: Create the whisper output fixture** (real whisper-cli `-oj` shape — `offsets` are milliseconds):

```json
{
  "systeminfo": "…",
  "model": { "type": "base" },
  "result": { "language": "en" },
  "transcription": [
    { "timestamps": { "from": "00:00:00,000", "to": "00:00:04,200" }, "offsets": { "from": 0, "to": 4200 }, "text": " Welcome to Daylight Disco everybody!" },
    { "timestamps": { "from": "00:00:04,200", "to": "00:00:09,500" }, "offsets": { "from": 4200, "to": 9500 }, "text": " The dance floor is officially open." },
    { "timestamps": { "from": "00:00:09,500", "to": "00:00:15,000" }, "offsets": { "from": 9500, "to": 15000 }, "text": " Look at these little movers go." }
  ]
}
```

Save as `test/fixtures/whisper-output.sample.json`.

- [ ] **Step 2: Write the failing test**

```typescript
// test/transcribe.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { transcribe, parseWhisperJson, type SubprocessRunner } from "../src/transcribe.ts";

const fixture = readFileSync(new URL("./fixtures/whisper-output.sample.json", import.meta.url), "utf8");

describe("parseWhisperJson", () => {
  it("maps whisper offsets to TranscriptSegments with trimmed text", () => {
    const segs = parseWhisperJson(fixture);
    expect(segs).toHaveLength(3);
    expect(segs[0]).toEqual({ start_ms: 0, end_ms: 4200, text: "Welcome to Daylight Disco everybody!" });
  });
});

describe("transcribe", () => {
  it("extracts audio then runs whisper, returning parsed segments", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ff-tr-"));
    const calls: string[][] = [];
    const runner: SubprocessRunner = async (bin, args) => {
      calls.push([bin, ...args]);
      if (bin === "whisper-cli") {
        // whisper writes <output>.json when given -oj/-of
        const of = args[args.indexOf("-of") + 1];
        writeFileSync(`${of}.json`, fixture);
      }
    };
    const segs = await transcribe("/footage/event.mp4", join(dir, "event"), runner);
    expect(calls[0][0]).toBe("ffmpeg");
    expect(calls[0]).toContain("16000");
    expect(calls[1][0]).toBe("whisper-cli");
    expect(segs).toHaveLength(3);
    rmSync(dir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run test/transcribe.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement**

```typescript
// src/transcribe.ts
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import type { TranscriptSegment } from "./types.ts";

export type SubprocessRunner = (bin: string, args: string[]) => Promise<void>;

export const defaultRunner: SubprocessRunner = (bin, args) =>
  new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${bin} exited ${code}: ${err.slice(-400)}`)),
    );
    p.on("error", reject);
  });

interface WhisperJson {
  transcription: Array<{ offsets: { from: number; to: number }; text: string }>;
}

export function parseWhisperJson(raw: string): TranscriptSegment[] {
  const parsed = JSON.parse(raw) as WhisperJson;
  if (!Array.isArray(parsed.transcription)) {
    throw new Error("whisper output has no transcription array");
  }
  return parsed.transcription.map((s) => ({
    start_ms: s.offsets.from,
    end_ms: s.offsets.to,
    text: s.text.trim(),
  }));
}

const DEFAULT_MODEL = "models/ggml-base.en.bin";

/**
 * videoPath → TranscriptSegment[]. Writes <outBase>.wav and <outBase>.json
 * (whisper's -of output). modelPath comes from config (WHISPER_MODEL_PATH).
 */
export async function transcribe(
  videoPath: string,
  outBase: string,
  runner: SubprocessRunner = defaultRunner,
  modelPath: string = DEFAULT_MODEL,
): Promise<TranscriptSegment[]> {
  const wav = `${outBase}.wav`;
  await runner("ffmpeg", ["-y", "-i", videoPath, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav]);
  await runner("whisper-cli", ["-m", modelPath, "-f", wav, "-oj", "-of", outBase, "-np"]);
  return parseWhisperJson(readFileSync(`${outBase}.json`, "utf8"));
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run test/transcribe.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add src/transcribe.ts test/transcribe.test.ts test/fixtures/whisper-output.sample.json
git commit -m "feat(factory): transcribe unit — ffmpeg audio extract + whisper.cpp JSON"
```

---

### Task 5: Highlight selection (`src/highlights.ts`)

Claude reads the transcript and returns highlight windows as strict JSON. Reuses the `CaptionCaller` function type from Plan 1 (`(prompt: string) => Promise<string>`) so `makeAnthropicCaller(cfg)` works unchanged.

**Files:**
- Create: `src/highlights.ts`
- Test: `test/highlights.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// test/highlights.test.ts
import { describe, it, expect } from "vitest";
import { buildHighlightPrompt, pickHighlights } from "../src/highlights.ts";
import type { TranscriptSegment } from "../src/types.ts";

const segments: TranscriptSegment[] = [
  { start_ms: 0, end_ms: 4200, text: "Welcome to Daylight Disco everybody!" },
  { start_ms: 4200, end_ms: 9500, text: "The dance floor is officially open." },
  { start_ms: 9500, end_ms: 15000, text: "Look at these little movers go." },
];

describe("buildHighlightPrompt", () => {
  it("includes the hook, every segment with timestamps, and the JSON contract", () => {
    const p = buildHighlightPrompt(segments, "POV: toddler disco", 3, 15000);
    expect(p).toContain("POV: toddler disco");
    expect(p).toContain("[0–4200ms] Welcome to Daylight Disco everybody!");
    expect(p).toContain("start_ms");
    expect(p).toContain("Return ONLY a JSON array");
  });
});

describe("pickHighlights", () => {
  it("parses the model's JSON array into validated windows", async () => {
    const caller = async () => '[{"start_ms": 4200, "end_ms": 15000, "reason": "energy"}]';
    const w = await pickHighlights(segments, "hook", 1, 15000, caller);
    expect(w).toEqual([{ start_ms: 4200, end_ms: 15000, reason: "energy" }]);
  });

  it("tolerates prose around the JSON array", async () => {
    const caller = async () => 'Here you go:\n[{"start_ms": 0, "end_ms": 9500, "reason": "opener"}]\nEnjoy!';
    const w = await pickHighlights(segments, "hook", 1, 15000, caller);
    expect(w).toHaveLength(1);
  });

  it("throws when the response has no JSON array", async () => {
    const caller = async () => "sorry, no";
    await expect(pickHighlights(segments, "hook", 1, 15000, caller)).rejects.toThrow(/no JSON array/);
  });

  it("throws when a window exceeds the video duration", async () => {
    const caller = async () => '[{"start_ms": 0, "end_ms": 99999, "reason": "x"}]';
    await expect(pickHighlights(segments, "hook", 1, 15000, caller)).rejects.toThrow(/duration/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/highlights.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```typescript
// src/highlights.ts
import type { TranscriptSegment, HighlightWindow } from "./types.ts";
import { parseHighlightWindows } from "./types.ts";
import type { CaptionCaller } from "./write-copy.ts";

export function buildHighlightPrompt(
  segments: TranscriptSegment[],
  hook: string,
  maxWindows: number,
  durationMs: number,
): string {
  const lines = segments.map((s) => `[${s.start_ms}–${s.end_ms}ms] ${s.text}`);
  return [
    `You pick highlight moments from real Family Frequencies event footage (family daytime disco, Mt Maunganui NZ) to become short vertical social clips.`,
    `The post's hook: "${hook}".`,
    `Transcript with millisecond offsets (video is ${durationMs}ms long):`,
    lines.join("\n"),
    `Pick up to ${maxWindows} windows that best match the hook's energy. Each window must be 8000–30000ms long, within the video, and start/end at natural moments (not mid-word).`,
    `Return ONLY a JSON array like [{"start_ms": 0, "end_ms": 12000, "reason": "..."}]. No markdown, no commentary.`,
  ].join("\n\n");
}

export async function pickHighlights(
  segments: TranscriptSegment[],
  hook: string,
  maxWindows: number,
  durationMs: number,
  caller: CaptionCaller,
): Promise<HighlightWindow[]> {
  const raw = await caller(buildHighlightPrompt(segments, hook, maxWindows, durationMs));
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`highlight response contained no JSON array: "${raw.slice(0, 80)}"`);
  }
  return parseHighlightWindows(JSON.parse(raw.slice(start, end + 1)), durationMs);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/highlights.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/highlights.ts test/highlights.test.ts
git commit -m "feat(factory): Claude highlight-window selection from transcript"
```

---

### Task 6: Clip cutting (`src/clip.ts`)

Pure functions for SRT generation and ffmpeg arg-building (tested exactly), plus a thin `cutClip` executor using the injected runner from Task 4. Crop is a centered 9:16 crop → scale 1080×1920 → burned subtitles.

**Files:**
- Create: `src/clip.ts`
- Test: `test/clip.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// test/clip.test.ts
import { describe, it, expect } from "vitest";
import { makeSrt, buildClipArgs, cutClip } from "../src/clip.ts";
import type { TranscriptSegment } from "../src/types.ts";

const segments: TranscriptSegment[] = [
  { start_ms: 0, end_ms: 4200, text: "Welcome!" },
  { start_ms: 4200, end_ms: 9500, text: "Dance floor open." },
  { start_ms: 9500, end_ms: 15000, text: "Little movers." },
];

describe("makeSrt", () => {
  it("keeps only overlapping segments, re-based to the window start", () => {
    const srt = makeSrt(segments, { start_ms: 4200, end_ms: 15000, reason: "" });
    expect(srt).toContain("1\n00:00:00,000 --> 00:00:05,300\nDance floor open.");
    expect(srt).toContain("2\n00:00:05,300 --> 00:00:10,800\nLittle movers.");
    expect(srt).not.toContain("Welcome!");
  });

  it("clamps a segment that starts before the window", () => {
    const srt = makeSrt(segments, { start_ms: 6000, end_ms: 15000, reason: "" });
    expect(srt.startsWith("1\n00:00:00,000 -->")).toBe(true);
  });
});

describe("buildClipArgs", () => {
  it("seeks, trims, crops to 9:16, scales to 1080x1920 and burns the srt", () => {
    const args = buildClipArgs("in.mp4", "out.mp4", { start_ms: 4200, end_ms: 15000, reason: "" }, "subs.srt");
    const joined = args.join(" ");
    expect(joined).toContain("-ss 4.2");
    expect(joined).toContain("-t 10.8");
    expect(joined).toContain("crop=ih*9/16:ih");
    expect(joined).toContain("scale=1080:1920");
    expect(joined).toContain("subtitles=subs.srt");
    expect(args[args.length - 1]).toBe("out.mp4");
  });
});

describe("cutClip", () => {
  it("writes the srt then invokes ffmpeg via the runner", async () => {
    const calls: string[][] = [];
    const files: Record<string, string> = {};
    await cutClip({
      inputPath: "in.mp4",
      outPath: "out.mp4",
      srtPath: "subs.srt",
      window: { start_ms: 0, end_ms: 9500, reason: "" },
      segments,
      runner: async (bin, args) => { calls.push([bin, ...args]); },
      writeFile: (p, c) => { files[p] = c; },
    });
    expect(files["subs.srt"]).toContain("Welcome!");
    expect(calls[0][0]).toBe("ffmpeg");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/clip.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```typescript
// src/clip.ts
import { writeFileSync } from "node:fs";
import type { TranscriptSegment, HighlightWindow } from "./types.ts";
import { defaultRunner, type SubprocessRunner } from "./transcribe.ts";

function srtTime(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const r = ms % 1000;
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(r, 3)}`;
}

/** Segments overlapping the window, re-based so 0 = window start. */
export function makeSrt(segments: TranscriptSegment[], window: HighlightWindow): string {
  const inWindow = segments.filter((s) => s.end_ms > window.start_ms && s.start_ms < window.end_ms);
  return inWindow
    .map((s, i) => {
      const from = Math.max(0, s.start_ms - window.start_ms);
      const to = Math.min(window.end_ms, s.end_ms) - window.start_ms;
      return `${i + 1}\n${srtTime(from)} --> ${srtTime(to)}\n${s.text}\n`;
    })
    .join("\n");
}

const SUB_STYLE =
  "FontName=Barlow Condensed,FontSize=16,PrimaryColour=&HFFFFFF&,OutlineColour=&H66000000&,BorderStyle=1,Outline=2,Shadow=0,Alignment=2,MarginV=64";

export function buildClipArgs(
  inputPath: string,
  outPath: string,
  window: HighlightWindow,
  srtPath: string,
): string[] {
  const start = window.start_ms / 1000;
  const dur = (window.end_ms - window.start_ms) / 1000;
  // Centered 9:16 crop of whatever the source aspect is, then 1080x1920 + burned subs.
  const vf = `crop=ih*9/16:ih,scale=1080:1920,subtitles=${srtPath}:force_style='${SUB_STYLE}'`;
  return [
    "-y",
    "-ss", String(start),
    "-i", inputPath,
    "-t", String(dur),
    "-vf", vf,
    "-c:v", "libx264", "-preset", "fast", "-crf", "20",
    "-c:a", "aac", "-b:a", "128k",
    "-movflags", "+faststart",
    outPath,
  ];
}

export interface CutClipOpts {
  inputPath: string;
  outPath: string;
  srtPath: string;
  window: HighlightWindow;
  segments: TranscriptSegment[];
  runner?: SubprocessRunner;
  writeFile?: (path: string, content: string) => void;
}

export async function cutClip(opts: CutClipOpts): Promise<string> {
  const runner = opts.runner ?? defaultRunner;
  const write = opts.writeFile ?? ((p, c) => writeFileSync(p, c));
  write(opts.srtPath, makeSrt(opts.segments, opts.window));
  await runner("ffmpeg", buildClipArgs(opts.inputPath, opts.outPath, opts.window, opts.srtPath));
  return opts.outPath;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/clip.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Real-ffmpeg smoke test** (ffmpeg is installed; this catches filter-string typos unit tests can't). Append to `test/clip.test.ts`:

```typescript
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultRunner } from "../src/transcribe.ts";

describe("cutClip against real ffmpeg", () => {
  it("produces a playable 9:16 mp4 from a generated test video", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ff-clip-"));
    const src = join(dir, "src.mp4");
    // 6s synthetic test video with a tone, landscape 1280x720
    await defaultRunner("ffmpeg", ["-y", "-f", "lavfi", "-i", "testsrc=duration=6:size=1280x720:rate=24", "-f", "lavfi", "-i", "sine=frequency=440:duration=6", "-c:v", "libx264", "-c:a", "aac", "-shortest", src]);
    const out = join(dir, "out.mp4");
    await cutClip({
      inputPath: src,
      outPath: out,
      srtPath: join(dir, "subs.srt"),
      window: { start_ms: 1000, end_ms: 4000, reason: "" },
      segments: [{ start_ms: 0, end_ms: 6000, text: "Test caption" }],
    });
    expect(existsSync(out)).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  }, 60_000);
});
```

Run: `npx vitest run test/clip.test.ts`
Expected: PASS (5 tests; the smoke test takes a few seconds)

- [ ] **Step 6: Commit**

```bash
git add src/clip.ts test/clip.test.ts
git commit -m "feat(factory): clip unit — SRT burn + 9:16 ffmpeg cut, with real-ffmpeg smoke test"
```

---

### Task 7: Config extension (`src/config.ts`)

**Files:**
- Modify: `src/config.ts`
- Test: `test/config.test.ts` (append)
- Modify: `.env.example`

- [ ] **Step 1: Write the failing tests** — append to `test/config.test.ts`:

```typescript
describe("publish config", () => {
  const base = {
    ANTHROPIC_API_KEY: "k",
    CLOUDINARY_CLOUD_NAME: "cn",
    CLOUDINARY_API_KEY: "ck",
    CLOUDINARY_API_SECRET: "cs",
    TELEGRAM_BOT_TOKEN: "t",
    TELEGRAM_CHAT_ID: "c",
  };

  it("loads cloudinary + telegram + defaults for webhook and whisper model", () => {
    const cfg = loadConfig(base);
    expect(cfg.cloudinary).toEqual({ cloudName: "cn", apiKey: "ck", apiSecret: "cs" });
    expect(cfg.telegram).toEqual({ botToken: "t", chatId: "c" });
    expect(cfg.submitWebhookUrl).toBe("https://n8n-production-4a398.up.railway.app/webhook/ff-submit-post");
    expect(cfg.whisperModelPath).toBe("models/ggml-base.en.bin");
  });

  it("leaves cloudinary and telegram undefined when their keys are absent (offline dev)", () => {
    const cfg = loadConfig({ ANTHROPIC_API_KEY: "k" });
    expect(cfg.cloudinary).toBeUndefined();
    expect(cfg.telegram).toBeUndefined();
  });

  it("honours overrides", () => {
    const cfg = loadConfig({ ...base, N8N_SUBMIT_WEBHOOK: "http://x/hook", WHISPER_MODEL_PATH: "/m.bin" });
    expect(cfg.submitWebhookUrl).toBe("http://x/hook");
    expect(cfg.whisperModelPath).toBe("/m.bin");
  });
});
```

(`loadConfig`, `describe`, `it`, `expect` already imported in this file.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/config.test.ts`
Expected: FAIL — `cfg.cloudinary` undefined property assertions

- [ ] **Step 3: Implement** — replace the contents of `src/config.ts` with:

```typescript
export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export interface FactoryConfig {
  anthropicApiKey: string;
  claudeModel: string;
  /** undefined when CLOUDINARY_* not set — publish stage will refuse to run */
  cloudinary?: CloudinaryConfig;
  /** undefined when TELEGRAM_* not set — batch summary skipped */
  telegram?: TelegramConfig;
  submitWebhookUrl: string;
  whisperModelPath: string;
}

const DEFAULT_SUBMIT_WEBHOOK = "https://n8n-production-4a398.up.railway.app/webhook/ff-submit-post";

export function loadConfig(env: Record<string, string | undefined> = process.env): FactoryConfig {
  const anthropicApiKey = env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set. Copy .env.example to .env and fill it in.");
  }
  const cloudinary =
    env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
      ? { cloudName: env.CLOUDINARY_CLOUD_NAME, apiKey: env.CLOUDINARY_API_KEY, apiSecret: env.CLOUDINARY_API_SECRET }
      : undefined;
  const telegram =
    env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID
      ? { botToken: env.TELEGRAM_BOT_TOKEN, chatId: env.TELEGRAM_CHAT_ID }
      : undefined;
  return {
    anthropicApiKey,
    claudeModel: env.CLAUDE_MODEL || "claude-sonnet-4-6",
    cloudinary,
    telegram,
    submitWebhookUrl: env.N8N_SUBMIT_WEBHOOK || DEFAULT_SUBMIT_WEBHOOK,
    whisperModelPath: env.WHISPER_MODEL_PATH || "models/ggml-base.en.bin",
  };
}
```

- [ ] **Step 4: Run the full suite** (config is imported everywhere)

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 5: Update `.env.example`** — replace its contents with:

```
ANTHROPIC_API_KEY=
CLAUDE_MODEL=claude-sonnet-4-6
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
N8N_SUBMIT_WEBHOOK=https://n8n-production-4a398.up.railway.app/webhook/ff-submit-post
WHISPER_MODEL_PATH=models/ggml-base.en.bin
```

(Real values already exist in the repo root `.env` — copy them over, never commit them.)

- [ ] **Step 6: Commit**

```bash
git add src/config.ts test/config.test.ts .env.example
git commit -m "feat(factory): config for cloudinary, telegram, submit webhook, whisper model"
```

---

### Task 8: Publish (`src/publish.ts`)

Cloudinary upload + WF01 webhook + Telegram batch summary, all injectable. The queue row's `caption` is the Instagram caption (the scheduler posts to Instagram); TikTok/FB variants stay in the staged captions JSON, referenced from `notes`.

**Files:**
- Create: `src/publish.ts`
- Test: `test/publish.test.ts`
- Modify: `package.json` (add `cloudinary` dependency)

- [ ] **Step 1: Install the SDK**

Run: `npm install cloudinary@^2`
Expected: adds `cloudinary` to dependencies, lockfile updated, 0 vulnerabilities

- [ ] **Step 2: Write the failing test**

```typescript
// test/publish.test.ts
import { describe, it, expect } from "vitest";
import { buildQueueSubmission, publishAsset, sendTelegramSummary } from "../src/publish.ts";
import type { CyclePlanEntry, CaptionSet } from "../src/types.ts";

const entry: CyclePlanEntry = {
  recipe_id: "C1", pillar: "community", frame_or_painting: "painting",
  type: "reel", template: null, hook: "POV: toddler disco",
  source: "clip", scheduled_at: "2026-07-13T09:00:00",
};
const captions: CaptionSet = { instagram: "IG cap #FamilyFrequencies", tiktok: "tt", facebook: "fb" };

describe("buildQueueSubmission", () => {
  it("maps entry + captions + media url to the WF01 body", () => {
    const s = buildQueueSubmission(entry, captions, "https://res.cloudinary.com/x/c1.mp4", "run-1");
    expect(s).toEqual({
      type: "reel",
      caption: "IG cap #FamilyFrequencies",
      media_url: "https://res.cloudinary.com/x/c1.mp4",
      scheduled_at: "2026-07-13T09:00:00",
      needs_music: true,
      notes: "C1 (factory run-1) — TikTok/FB caption variants in work/run-1/captions/C1.json",
    });
  });

  it("only reels need music", () => {
    const still = { ...entry, recipe_id: "ED1", type: "feed" as const, source: "render" as const };
    expect(buildQueueSubmission(still, captions, "u", "run-1").needs_music).toBe(false);
  });
});

describe("publishAsset", () => {
  it("uploads then posts to the webhook and returns the media url", async () => {
    const posted: unknown[] = [];
    const res = await publishAsset({
      entry, captions, runId: "run-1", assetPath: "/work/run-1/clips/C1.mp4",
      upload: async (path, kind) => {
        expect(path).toBe("/work/run-1/clips/C1.mp4");
        expect(kind).toBe("video");
        return "https://res.cloudinary.com/x/c1.mp4";
      },
      post: async (url, body) => {
        posted.push({ url, body });
        return { success: true, id: "123" };
      },
      webhookUrl: "http://hook",
    });
    expect(res.media_url).toBe("https://res.cloudinary.com/x/c1.mp4");
    expect(posted).toHaveLength(1);
  });

  it("uploads stills as images", async () => {
    const still = { ...entry, recipe_id: "ED1", type: "feed" as const, source: "render" as const };
    let kindSeen = "";
    await publishAsset({
      entry: still, captions, runId: "r", assetPath: "/x/ED1.png",
      upload: async (_p, kind) => { kindSeen = kind; return "u"; },
      post: async () => ({ success: true, id: "1" }),
      webhookUrl: "http://hook",
    });
    expect(kindSeen).toBe("image");
  });

  it("propagates a webhook failure", async () => {
    await expect(publishAsset({
      entry, captions, runId: "r", assetPath: "/x.mp4",
      upload: async () => "u",
      post: async () => { throw new Error("webhook 500"); },
      webhookUrl: "http://hook",
    })).rejects.toThrow(/webhook 500/);
  });
});

describe("sendTelegramSummary", () => {
  it("posts the batch message to the bot API", async () => {
    const sent: Array<{ url: string; body: unknown }> = [];
    await sendTelegramSummary(
      { botToken: "TOK", chatId: "42" },
      "Batch ready: 3 posts to approve",
      async (url, body) => { sent.push({ url, body }); return {}; },
    );
    expect(sent[0].url).toBe("https://api.telegram.org/botTOK/sendMessage");
    expect(sent[0].body).toEqual({ chat_id: "42", text: "Batch ready: 3 posts to approve" });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run test/publish.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement**

```typescript
// src/publish.ts
import { v2 as cloudinary } from "cloudinary";
import type { CyclePlanEntry, CaptionSet, QueueSubmission } from "./types.ts";
import type { CloudinaryConfig, TelegramConfig } from "./config.ts";

export type MediaKind = "video" | "image";
export type Uploader = (path: string, kind: MediaKind) => Promise<string>;
export type JsonPoster = (url: string, body: unknown) => Promise<unknown>;

export function makeCloudinaryUploader(cfg: CloudinaryConfig): Uploader {
  cloudinary.config({ cloud_name: cfg.cloudName, api_key: cfg.apiKey, api_secret: cfg.apiSecret });
  return async (path, kind) => {
    const res = await cloudinary.uploader.upload(path, {
      resource_type: kind,
      folder: "ff-factory",
      use_filename: true,
      unique_filename: true,
    });
    return res.secure_url;
  };
}

export const defaultPoster: JsonPoster = async (url, body) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${url} failed: ${res.status} ${await res.text()}`);
  return res.json();
};

export function buildQueueSubmission(
  entry: CyclePlanEntry,
  captions: CaptionSet,
  mediaUrl: string,
  runId: string,
): QueueSubmission {
  return {
    type: entry.type,
    caption: captions.instagram,
    media_url: mediaUrl,
    scheduled_at: entry.scheduled_at,
    needs_music: entry.type === "reel",
    notes: `${entry.recipe_id} (factory ${runId}) — TikTok/FB caption variants in work/${runId}/captions/${entry.recipe_id}.json`,
  };
}

export interface PublishAssetOpts {
  entry: CyclePlanEntry;
  captions: CaptionSet;
  runId: string;
  assetPath: string;
  upload: Uploader;
  post: JsonPoster;
  webhookUrl: string;
}

export async function publishAsset(opts: PublishAssetOpts): Promise<{ media_url: string }> {
  const kind: MediaKind = opts.assetPath.endsWith(".png") ? "image" : "video";
  const mediaUrl = await opts.upload(opts.assetPath, kind);
  await opts.post(opts.webhookUrl, buildQueueSubmission(opts.entry, opts.captions, mediaUrl, opts.runId));
  return { media_url: mediaUrl };
}

export async function sendTelegramSummary(
  tg: TelegramConfig,
  text: string,
  post: JsonPoster = defaultPoster,
): Promise<void> {
  await post(`https://api.telegram.org/bot${tg.botToken}/sendMessage`, { chat_id: tg.chatId, text });
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run test/publish.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add src/publish.ts test/publish.test.ts package.json package-lock.json
git commit -m "feat(factory): publish unit — Cloudinary upload + WF01 webhook + Telegram summary"
```

---

### Task 9: CLI orchestration (`src/index.ts`)

Wire the pipeline: per entry, route by `source` (`render` → Plan 1 stills; `clip` → transcribe + highlights + cut; `footage` → cut hand-picked file whole with captions); stage everything under `work/<run-id>/`; captions saved per recipe; **publish runs only if every entry staged with zero errors** (all-or-nothing, per the design); `--no-publish` for offline/dry runs; run report printed and Telegram-summarised.

**Files:**
- Modify: `src/index.ts`
- Modify: `package.json` (nothing new — `npm run factory` already exists)

- [ ] **Step 1: Replace `src/index.ts` with the orchestrator**

```typescript
import "dotenv/config";
import { readFileSync, writeFileSync, statSync, existsSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { parseArgs } from "node:util";
import { parseCyclePlan, type CaptionSet, type CyclePlanEntry, type RunReport, type RunReportItem, type TranscriptSegment } from "./types.ts";
import { loadConfig, type FactoryConfig } from "./config.ts";
import { loadRegistry, getTemplate } from "./templates.ts";
import { renderStill } from "./render-stills.ts";
import { writeCopy, makeAnthropicCaller, type CaptionCaller } from "./write-copy.ts";
import { assertToolsAvailable } from "./tools.ts";
import { Staging } from "./staging.ts";
import { transcribe } from "./transcribe.ts";
import { pickHighlights } from "./highlights.ts";
import { cutClip } from "./clip.ts";
import { makeCloudinaryUploader, publishAsset, sendTelegramSummary, defaultPoster } from "./publish.ts";

function videoDurationMs(segments: TranscriptSegment[]): number {
  return segments.length ? segments[segments.length - 1].end_ms : 0;
}

async function stageEntry(
  entry: CyclePlanEntry,
  staging: Staging,
  cfg: FactoryConfig,
  caller: CaptionCaller,
  footageDir: string | undefined,
  eventTranscript: { segments: TranscriptSegment[]; sourceVideo: string } | null,
): Promise<RunReportItem> {
  const item: RunReportItem = { recipe_id: entry.recipe_id, asset: null, media_url: null, published: false, skipped: false, errors: [] };

  // captions (all sources need them)
  const captionsPath = staging.path("captions", `${entry.recipe_id}.json`);
  if (staging.isDone(entry.recipe_id, "captions")) {
    item.skipped = true;
  } else {
    try {
      const captions = await writeCopy(entry, caller);
      writeFileSync(captionsPath, JSON.stringify(captions, null, 2));
      staging.markDone(entry.recipe_id, "captions");
    } catch (e) {
      item.errors.push(`captions: ${(e as Error).message}`);
    }
  }

  // asset
  try {
    if (entry.source === "render") {
      const out = staging.path("stills", `${entry.recipe_id}.png`);
      if (!staging.isDone(entry.recipe_id, "asset")) {
        if (!entry.template) throw new Error("source=render requires a template");
        const spec = getTemplate(loadRegistry(), entry.template);
        const data: Record<string, string> = {};
        if (entry.event_facts) {
          data.date = entry.event_facts.date;
          data.venue = entry.event_facts.venue;
          if (entry.event_facts.time) data.time = entry.event_facts.time;
          if (entry.event_facts.cost) data.cost = entry.event_facts.cost;
        }
        await renderStill({ spec, data, outPath: out });
        staging.markDone(entry.recipe_id, "asset");
      }
      item.asset = out;
    } else if (entry.source === "clip") {
      if (!eventTranscript) throw new Error("source=clip needs --footage with at least one video");
      const out = staging.path("clips", `${entry.recipe_id}.mp4`);
      if (!staging.isDone(entry.recipe_id, "asset")) {
        const dur = videoDurationMs(eventTranscript.segments);
        const [win] = await pickHighlights(eventTranscript.segments, entry.hook, 1, dur, caller);
        if (!win) throw new Error("no highlight window returned");
        await cutClip({
          inputPath: eventTranscript.sourceVideo,
          outPath: out,
          srtPath: staging.path("clips", `${entry.recipe_id}.srt`),
          window: win,
          segments: eventTranscript.segments,
        });
        staging.markDone(entry.recipe_id, "asset");
      }
      item.asset = out;
    } else {
      // source=footage: hand-picked file, cut whole with burned captions
      if (!entry.footage_file || !footageDir) throw new Error("source=footage requires footage_file + --footage");
      const src = join(footageDir, entry.footage_file);
      if (!existsSync(src)) throw new Error(`footage file not found: ${src}`);
      const out = staging.path("clips", `${entry.recipe_id}.mp4`);
      if (!staging.isDone(entry.recipe_id, "asset")) {
        const base = staging.path("transcripts", entry.recipe_id);
        const segments = await transcribe(src, base, undefined, cfg.whisperModelPath);
        const dur = videoDurationMs(segments);
        await cutClip({
          inputPath: src,
          outPath: out,
          srtPath: staging.path("clips", `${entry.recipe_id}.srt`),
          window: { start_ms: 0, end_ms: Math.max(dur, 1000), reason: "hand-picked" },
          segments,
        });
        staging.markDone(entry.recipe_id, "asset");
      }
      item.asset = out;
    }
  } catch (e) {
    item.errors.push(`asset: ${(e as Error).message}`);
  }

  return item;
}

function findEventVideo(footageDir: string): string | null {
  const vids = readdirSync(footageDir)
    .filter((f) => /\.(mp4|mov|m4v)$/i.test(f))
    .map((f) => join(footageDir, f))
    .sort((a, b) => statSync(b).size - statSync(a).size);
  return vids[0] ?? null;
}

async function main() {
  const { values } = parseArgs({
    options: {
      plan: { type: "string" },
      footage: { type: "string" },
      "run-id": { type: "string" },
      "no-publish": { type: "boolean" },
    },
  });
  if (!values.plan) throw new Error("Usage: npm run factory -- --plan <cycle-plan.json> [--footage <dir>] [--run-id <id>] [--no-publish]");

  const cfg = loadConfig();
  const plan = parseCyclePlan(JSON.parse(readFileSync(values.plan, "utf8")));
  const needsVideo = plan.some((e) => e.source !== "render");
  assertToolsAvailable(needsVideo ? ["ffmpeg", "whisper-cli"] : []);

  const runId = values["run-id"] ?? new Date().toISOString().slice(0, 10);
  const staging = new Staging("work", runId);
  const caller = makeAnthropicCaller(cfg);

  // Transcribe the event video once, shared by every source=clip entry.
  let eventTranscript: { segments: TranscriptSegment[]; sourceVideo: string } | null = null;
  if (plan.some((e) => e.source === "clip")) {
    if (!values.footage) throw new Error("plan has source=clip entries — pass --footage <dir>");
    const video = findEventVideo(values.footage);
    if (!video) throw new Error(`no video files found in ${values.footage}`);
    const base = staging.path("transcripts", basename(video).replace(/\.[^.]+$/, ""));
    const segments = existsSync(`${base}.json`)
      ? (await import("./transcribe.ts")).parseWhisperJson(readFileSync(`${base}.json`, "utf8"))
      : await transcribe(video, base, undefined, cfg.whisperModelPath);
    eventTranscript = { segments, sourceVideo: video };
    console.log(`Transcribed ${basename(video)}: ${segments.length} segments`);
  }

  const report: RunReport = { run_id: runId, items: [] };
  for (const entry of plan) {
    const item = await stageEntry(entry, staging, cfg, caller, values.footage, eventTranscript);
    report.items.push(item);
    console.log(`• ${entry.recipe_id}: ${item.asset ? "asset ✓" : "asset ✗"}${item.skipped ? " (resumed)" : ""}${item.errors.length ? " — " + item.errors.join("; ") : ""}`);
  }

  const failed = report.items.filter((i) => i.errors.length > 0);
  const canPublish = failed.length === 0 && !values["no-publish"];

  if (canPublish) {
    if (!cfg.cloudinary) throw new Error("CLOUDINARY_* not set — cannot publish (use --no-publish to stage only)");
    const upload = makeCloudinaryUploader(cfg.cloudinary);
    for (const item of report.items) {
      if (staging.isDone(item.recipe_id, "published")) { item.published = true; continue; }
      const entry = plan.find((e) => e.recipe_id === item.recipe_id)!;
      const captions = JSON.parse(readFileSync(staging.path("captions", `${entry.recipe_id}.json`), "utf8")) as CaptionSet;
      const { media_url } = await publishAsset({
        entry, captions, runId, assetPath: item.asset!,
        upload, post: defaultPoster, webhookUrl: cfg.submitWebhookUrl,
      });
      item.media_url = media_url;
      item.published = true;
      staging.markDone(item.recipe_id, "published");
      console.log(`↑ ${item.recipe_id} → queue (draft): ${media_url}`);
    }
    if (cfg.telegram) {
      await sendTelegramSummary(cfg.telegram, `🏭 Factory batch ready: ${report.items.length} posts in the queue as drafts — reply APPROVE on each Telegram draft to schedule.`);
    }
  } else if (failed.length > 0) {
    console.log(`\n⚠ ${failed.length} item(s) failed — nothing published. Fix and re-run with --run-id ${runId} to resume.`);
  } else {
    console.log(`\nStaged only (--no-publish). Re-run without the flag and with --run-id ${runId} to publish.`);
  }

  writeFileSync(staging.path("done", "report.json"), JSON.stringify(report, null, 2));
  const ok = report.items.filter((i) => i.errors.length === 0).length;
  console.log(`\nRun ${runId}: ${ok}/${report.items.length} staged clean, ${report.items.filter((i) => i.published).length} published. Staging: work/${runId}/`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Typecheck + full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: typecheck clean, ALL tests PASS

- [ ] **Step 3: Offline smoke run** — stills-only plan needs no video tools:

Run: `npm run factory -- --plan test/fixtures/cycle-plan.sample.json --no-publish --run-id smoke`
Expected: renders + captions staged under `work/smoke/`, report printed, "Staged only" message, exit 0. Run it twice — second run should print `(resumed)` items and be near-instant.

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat(factory): orchestrate clip pipeline + all-or-nothing publish with resumable runs"
```

---

### Task 10: Setup docs + whisper model bootstrap

**Files:**
- Modify: `README.md`
- Modify: `package.json` (add `setup:whisper` script)

- [ ] **Step 1: Add the model-download script** to `package.json` `"scripts"`:

```json
"setup:whisper": "mkdir -p models && curl -L -o models/ggml-base.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin"
```

- [ ] **Step 2: Update `README.md`** — add after the existing setup section:

```markdown
## Video pipeline setup (Plan 2)

One-time, on the Mac that runs batches:

    brew install ffmpeg whisper-cpp
    npm run setup:whisper          # downloads ggml-base.en.bin (~142MB) into models/

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
```

- [ ] **Step 3: Run the whisper setup for real** (needs network; ~142MB):

Run: `brew install whisper-cpp && npm run setup:whisper`
Expected: `whisper-cli --help` works; `models/ggml-base.en.bin` exists

- [ ] **Step 4: Full suite + typecheck one last time**

Run: `npx tsc --noEmit && npx vitest run`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add README.md package.json
git commit -m "docs(factory): Plan 2 setup + batch-day instructions, whisper model bootstrap"
```

---

### Task 11: End-to-end smoke on a real fixture (manual gate)

Not a vitest test — a scripted manual verification that the pipeline holds together on this machine, using synthetic footage so no real event video is needed.

- [ ] **Step 1: Generate a 30s synthetic "event video" with speech-free audio**

```bash
mkdir -p /tmp/ff-e2e/footage
ffmpeg -y -f lavfi -i "testsrc=duration=30:size=1280x720:rate=24" -f lavfi -i "sine=frequency=440:duration=30" -c:v libx264 -c:a aac -shortest /tmp/ff-e2e/footage/event.mp4
```

- [ ] **Step 2: Write `/tmp/ff-e2e/plan.json`**

```json
[
  {
    "recipe_id": "E2E1",
    "pillar": "community",
    "frame_or_painting": "painting",
    "type": "reel",
    "hook": "POV: the whole family found the dance floor",
    "source": "clip",
    "scheduled_at": "2026-08-01T09:00:00"
  }
]
```

- [ ] **Step 3: Staged run (no publish)**

Run: `npm run factory -- --plan /tmp/ff-e2e/plan.json --footage /tmp/ff-e2e/footage --run-id e2e --no-publish`

Expected: transcription runs (synthetic audio → few/empty segments is fine — if whisper returns zero segments the highlight step will fail cleanly and report it; that's a correct all-or-nothing outcome and still proves the plumbing). A clean staging of captions + report under `work/e2e/`. **If the highlight step fails on empty transcript, that's the expected result for tone-only audio — verify the error is reported and nothing published, then optionally re-test with any real phone video.**

- [ ] **Step 4: Verify nothing hit the live queue**

Run: `curl -sL "https://docs.google.com/spreadsheets/d/1FIrB4lsDqJuGvoOpNTfNhM64xfkg6TkUVNTPhGWvR1g/export?format=csv" | tail -3`
Expected: no `E2E1` row.

- [ ] **Step 5: Commit anything amended, then hand over**

```bash
git status   # should be clean apart from work/ (gitignored)
```

Report results to Holly: what staged, what the report said, whether a real-footage publish test is wanted before the next event batch.

---

## Self-review notes (author)

- **Spec coverage:** Ingest (unit 1) is folded into the orchestrator's source-routing + `findEventVideo` rather than a separate `ingest.ts` — the design's job-list normalisation is 20 lines, YAGNI on a module. Transcribe ✓ Task 4. Clip ✓ Tasks 5–6. Publish ✓ Task 8. Idempotent staging ✓ Task 3. Run report + Telegram ✓ Tasks 8–9. Startup tool check ✓ Task 1. All-or-nothing publish gate ✓ Task 9.
- **Type consistency:** `CaptionCaller` reused from `write-copy.ts` for highlights; `SubprocessRunner`/`defaultRunner` defined once in `transcribe.ts` and imported by `clip.ts`; `Staging.path/isDone/markDone` used identically in Tasks 3 and 9; `QueueSubmission` shape matches WF01's `Prepare Row` fields exactly (`type, caption, media_url, scheduled_at, needs_music, notes`).
- **Known deferrals (v1.1):** multi-window supercuts (v1 cuts 1 window per clip entry), smarter scene-cut detection, Remotion motion, per-platform caption columns in the sheet.
- **Publish safety:** rows land as `draft`, never `scheduled` — WF02 only posts `scheduled` rows, so a factory bug can never auto-post to Instagram; Holly's APPROVE is always in the loop.
