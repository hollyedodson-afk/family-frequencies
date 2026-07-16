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

describe("publish config", () => {
  const base = {
    ANTHROPIC_API_KEY: "k",
    CLOUDINARY_CLOUD_NAME: "cn",
    CLOUDINARY_API_KEY: "ck",
    CLOUDINARY_API_SECRET: "cs",
    TELEGRAM_BOT_TOKEN: "t",
    TELEGRAM_CHAT_ID: "c",
  };

  it("loads cloudinary + telegram + defaults for webhook and whisper model", () => {
    const cfg = loadConfig(base);
    expect(cfg.cloudinary).toEqual({ cloudName: "cn", apiKey: "ck", apiSecret: "cs" });
    expect(cfg.telegram).toEqual({ botToken: "t", chatId: "c" });
    expect(cfg.submitWebhookUrl).toBe("https://n8n-production-4a398.up.railway.app/webhook/ff-submit-post");
    expect(cfg.whisperModelPath).toBe("models/ggml-base.en.bin");
  });

  it("leaves cloudinary and telegram undefined when their keys are absent (offline dev)", () => {
    const cfg = loadConfig({ ANTHROPIC_API_KEY: "k" });
    expect(cfg.cloudinary).toBeUndefined();
    expect(cfg.telegram).toBeUndefined();
  });

  it("honours overrides", () => {
    const cfg = loadConfig({ ...base, N8N_SUBMIT_WEBHOOK: "http://x/hook", WHISPER_MODEL_PATH: "/m.bin" });
    expect(cfg.submitWebhookUrl).toBe("http://x/hook");
    expect(cfg.whisperModelPath).toBe("/m.bin");
  });
});
