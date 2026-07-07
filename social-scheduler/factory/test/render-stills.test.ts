import { describe, it, expect, afterAll } from "vitest";
import { existsSync, rmSync, statSync } from "node:fs";
import { renderStill } from "../src/render-stills.ts";
import { loadRegistry, getTemplate } from "../src/templates.ts";

const outDir = "test/.tmp-render";

describe("renderStill", () => {
  afterAll(() => { if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true }); });

  it("renders a date-card to a non-empty PNG", async () => {
    const spec = getTemplate(loadRegistry(), "date-card");
    const out = await renderStill({
      spec,
      data: { date: "SAT 2 AUG", venue: "HIDE, MT MAUNGANUI", time: "12–5PM", cost: "FREE" },
      outPath: `${outDir}/date-card.png`,
    });
    expect(existsSync(out)).toBe(true);
    expect(statSync(out).size).toBeGreaterThan(5000);
  });
});
