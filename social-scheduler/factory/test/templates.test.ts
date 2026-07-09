import { describe, it, expect } from "vitest";
import { loadRegistry, getTemplate } from "../src/templates.ts";

describe("template registry", () => {
  it("loads the registry and returns a known template spec", () => {
    const reg = loadRegistry();
    const spec = getTemplate(reg, "date-card");
    expect(spec.file).toBe("date-card.dc.html");
    expect(spec.width).toBe(1080);
    expect(spec.fields).toContain("venue");
  });

  it("throws for an unknown template key", () => {
    const reg = loadRegistry();
    expect(() => getTemplate(reg, "nope")).toThrow(/nope/);
  });
});
