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

  it("throws a clear error when the caller returns no JSON", async () => {
    await expect(writeCopy(entry, async () => "sorry, I can't do that")).rejects.toThrow(/no JSON object/);
  });

  it("throws a clear error when the JSON is malformed", async () => {
    await expect(writeCopy(entry, async () => "{ not valid json }")).rejects.toThrow(/not valid JSON/);
  });

  it("omits the time slot cleanly when event_facts has no time", () => {
    const noTime = { ...entry, event_facts: { date: "SAT 2 AUG", venue: "HIDE", cost: "FREE" } };
    const p = buildCaptionPrompt(noTime);
    expect(p).not.toContain(", ,");
    expect(p).toContain("HIDE, cost FREE");
  });
});
