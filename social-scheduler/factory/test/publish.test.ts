import { describe, it, expect } from "vitest";
import { buildQueueSubmission, publishAsset, sendTelegramSummary } from "../src/publish.ts";
import type { CyclePlanEntry, CaptionSet } from "../src/types.ts";

const entry: CyclePlanEntry = {
  recipe_id: "C1", pillar: "community", frame_or_painting: "painting",
  type: "reel", template: null, hook: "POV: toddler disco",
  source: "clip", scheduled_at: "2026-07-13T09:00:00",
};
const captions: CaptionSet = { instagram: "IG cap #FamilyFrequencies", tiktok: "tt", facebook: "fb" };

describe("buildQueueSubmission", () => {
  it("maps entry + captions + media url to the WF01 body", () => {
    const s = buildQueueSubmission(entry, captions, "https://res.cloudinary.com/x/c1.mp4", "run-1");
    expect(s).toEqual({
      type: "reel",
      caption: "IG cap #FamilyFrequencies",
      media_url: "https://res.cloudinary.com/x/c1.mp4",
      scheduled_at: "2026-07-13T09:00:00",
      needs_music: true,
      notes: "C1 (factory run-1) — TikTok/FB caption variants in work/run-1/captions/C1.json",
    });
  });

  it("only reels need music", () => {
    const still = { ...entry, recipe_id: "ED1", type: "feed" as const, source: "render" as const };
    expect(buildQueueSubmission(still, captions, "u", "run-1").needs_music).toBe(false);
  });
});

describe("publishAsset", () => {
  it("uploads then posts to the webhook and returns the media url", async () => {
    const posted: unknown[] = [];
    const res = await publishAsset({
      entry, captions, runId: "run-1", assetPath: "/work/run-1/clips/C1.mp4",
      upload: async (path, kind) => {
        expect(path).toBe("/work/run-1/clips/C1.mp4");
        expect(kind).toBe("video");
        return "https://res.cloudinary.com/x/c1.mp4";
      },
      post: async (url, body) => {
        posted.push({ url, body });
        return { success: true, id: "123" };
      },
      webhookUrl: "http://hook",
    });
    expect(res.media_url).toBe("https://res.cloudinary.com/x/c1.mp4");
    expect(posted).toHaveLength(1);
  });

  it("uploads stills as images", async () => {
    const still = { ...entry, recipe_id: "ED1", type: "feed" as const, source: "render" as const };
    let kindSeen = "";
    await publishAsset({
      entry: still, captions, runId: "r", assetPath: "/x/ED1.png",
      upload: async (_p, kind) => { kindSeen = kind; return "u"; },
      post: async () => ({ success: true, id: "1" }),
      webhookUrl: "http://hook",
    });
    expect(kindSeen).toBe("image");
  });

  it("propagates a webhook failure", async () => {
    await expect(publishAsset({
      entry, captions, runId: "r", assetPath: "/x.mp4",
      upload: async () => "u",
      post: async () => { throw new Error("webhook 500"); },
      webhookUrl: "http://hook",
    })).rejects.toThrow(/webhook 500/);
  });
});

describe("sendTelegramSummary", () => {
  it("posts the batch message to the bot API", async () => {
    const sent: Array<{ url: string; body: unknown }> = [];
    await sendTelegramSummary(
      { botToken: "TOK", chatId: "42" },
      "Batch ready: 3 posts to approve",
      async (url, body) => { sent.push({ url, body }); return {}; },
    );
    expect(sent[0].url).toBe("https://api.telegram.org/botTOK/sendMessage");
    expect(sent[0].body).toEqual({ chat_id: "42", text: "Batch ready: 3 posts to approve" });
  });
});
