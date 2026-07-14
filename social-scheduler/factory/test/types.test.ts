import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseCyclePlan, HighlightWindowSchema, parseHighlightWindows } from "../src/types.ts";

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
