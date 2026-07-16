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
import { transcribe, parseWhisperJson, probeDurationMs } from "./transcribe.ts";
import { pickHighlights } from "./highlights.ts";
import { cutClip } from "./clip.ts";
import { makeCloudinaryUploader, publishAsset, sendTelegramSummary, defaultPoster } from "./publish.ts";

function videoDurationMs(segments: TranscriptSegment[]): number {
  return segments.length ? segments[segments.length - 1].end_ms : 0;
}

function findEventVideo(footageDir: string): string | null {
  const vids = readdirSync(footageDir)
    .filter((f) => /\.(mp4|mov|m4v)$/i.test(f))
    .map((f) => join(footageDir, f))
    .sort((a, b) => statSync(b).size - statSync(a).size);
  return vids[0] ?? null;
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
      if (!entry.footage_file || !footageDir) throw new Error("source=footage requires footage_file + --footage");
      const src = join(footageDir, entry.footage_file);
      if (!existsSync(src)) throw new Error(`footage file not found: ${src}`);
      const out = staging.path("clips", `${entry.recipe_id}.mp4`);
      if (!staging.isDone(entry.recipe_id, "asset")) {
        const base = staging.path("transcripts", entry.recipe_id);
        const segments = existsSync(`${base}.json`)
          ? parseWhisperJson(readFileSync(`${base}.json`, "utf8"))
          : await transcribe(src, base, undefined, cfg.whisperModelPath);
        const dur = probeDurationMs(src);
        await cutClip({
          inputPath: src,
          outPath: out,
          srtPath: staging.path("clips", `${entry.recipe_id}.srt`),
          window: { start_ms: 0, end_ms: dur, reason: "hand-picked" },
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

  let eventTranscript: { segments: TranscriptSegment[]; sourceVideo: string } | null = null;
  if (plan.some((e) => e.source === "clip")) {
    if (!values.footage) throw new Error("plan has source=clip entries — pass --footage <dir>");
    const video = findEventVideo(values.footage);
    if (!video) throw new Error(`no video files found in ${values.footage}`);
    const base = staging.path("transcripts", basename(video).replace(/\.[^.]+$/, ""));
    const segments = existsSync(`${base}.json`)
      ? parseWhisperJson(readFileSync(`${base}.json`, "utf8"))
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
