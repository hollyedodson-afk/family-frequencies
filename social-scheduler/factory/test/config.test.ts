import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/config.ts";

describe("loadConfig", () => {
  it("returns config when the API key is present", () => {
    const cfg = loadConfig({ ANTHROPIC_API_KEY: "sk-test", CLAUDE_MODEL: "claude-sonnet-4-6" });
    expect(cfg.anthropicApiKey).toBe("sk-test");
    expect(cfg.claudeModel).toBe("claude-sonnet-4-6");
  });

  it("defaults the model when unset", () => {
    const cfg = loadConfig({ ANTHROPIC_API_KEY: "sk-test" });
    expect(cfg.claudeModel).toBe("claude-sonnet-4-6");
  });

  it("throws a clear error when the API key is missing", () => {
    expect(() => loadConfig({})).toThrow(/ANTHROPIC_API_KEY/);
  });
});
