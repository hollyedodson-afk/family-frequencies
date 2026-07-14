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
