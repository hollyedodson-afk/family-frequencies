import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Staging } from "../src/staging.ts";

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "ff-staging-")); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

describe("Staging", () => {
  it("creates the run directory tree", () => {
    const s = new Staging(root, "2026-07-13-a");
    expect(existsSync(join(root, "2026-07-13-a", "clips"))).toBe(true);
    expect(existsSync(join(root, "2026-07-13-a", "stills"))).toBe(true);
    expect(existsSync(join(root, "2026-07-13-a", "captions"))).toBe(true);
    expect(existsSync(join(root, "2026-07-13-a", "transcripts"))).toBe(true);
  });

  it("isDone is false until markDone, then true, and survives a new instance", () => {
    const s = new Staging(root, "run1");
    expect(s.isDone("C1", "clip")).toBe(false);
    writeFileSync(s.path("clips", "C1.mp4"), "fake");
    s.markDone("C1", "clip");
    expect(s.isDone("C1", "clip")).toBe(true);
    const s2 = new Staging(root, "run1");
    expect(s2.isDone("C1", "clip")).toBe(true);
  });

  it("path() returns paths inside the run dir", () => {
    const s = new Staging(root, "run1");
    expect(s.path("clips", "C1.mp4")).toBe(join(root, "run1", "clips", "C1.mp4"));
  });
});
