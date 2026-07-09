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
