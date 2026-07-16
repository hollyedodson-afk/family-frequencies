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
