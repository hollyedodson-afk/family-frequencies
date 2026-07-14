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
