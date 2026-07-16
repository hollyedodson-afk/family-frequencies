import { describe, it, expect } from "vitest";
import { assertToolsAvailable } from "../src/tools.ts";

describe("assertToolsAvailable", () => {
  it("passes when every binary resolves", () => {
    const which = (_bin: string) => true;
    expect(() => assertToolsAvailable(["ffmpeg", "whisper-cli"], which)).not.toThrow();
  });

  it("throws a brew-install hint naming every missing binary", () => {
    const which = (bin: string) => bin === "ffmpeg";
    expect(() => assertToolsAvailable(["ffmpeg", "whisper-cli"], which)).toThrow(
      /whisper-cli.*brew install whisper-cpp/s,
    );
  });
});
