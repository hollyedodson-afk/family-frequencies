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
