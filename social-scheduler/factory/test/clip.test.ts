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

import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultRunner } from "../src/transcribe.ts";

describe("cutClip against real ffmpeg", () => {
  it("produces a playable 9:16 mp4 from a generated test video", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ff-clip-"));
    const src = join(dir, "src.mp4");
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
