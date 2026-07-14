import { v2 as cloudinary } from "cloudinary";
import type { CyclePlanEntry, CaptionSet, QueueSubmission } from "./types.ts";
import type { CloudinaryConfig, TelegramConfig } from "./config.ts";

export type MediaKind = "video" | "image";
export type Uploader = (path: string, kind: MediaKind) => Promise<string>;
export type JsonPoster = (url: string, body: unknown) => Promise<unknown>;

export function makeCloudinaryUploader(cfg: CloudinaryConfig): Uploader {
  cloudinary.config({ cloud_name: cfg.cloudName, api_key: cfg.apiKey, api_secret: cfg.apiSecret });
  return async (path, kind) => {
    const res = await cloudinary.uploader.upload(path, {
      resource_type: kind,
      folder: "ff-factory",
      use_filename: true,
      unique_filename: true,
    });
    return res.secure_url;
  };
}

export const defaultPoster: JsonPoster = async (url, body) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${url} failed: ${res.status} ${await res.text()}`);
  return res.json();
};

export function buildQueueSubmission(
  entry: CyclePlanEntry,
  captions: CaptionSet,
  mediaUrl: string,
  runId: string,
): QueueSubmission {
  return {
    type: entry.type,
    caption: captions.instagram,
    media_url: mediaUrl,
    scheduled_at: entry.scheduled_at,
    needs_music: entry.type === "reel",
    notes: `${entry.recipe_id} (factory ${runId}) — TikTok/FB caption variants in work/${runId}/captions/${entry.recipe_id}.json`,
  };
}

export interface PublishAssetOpts {
  entry: CyclePlanEntry;
  captions: CaptionSet;
  runId: string;
  assetPath: string;
  upload: Uploader;
  post: JsonPoster;
  webhookUrl: string;
}

export async function publishAsset(opts: PublishAssetOpts): Promise<{ media_url: string }> {
  const kind: MediaKind = opts.assetPath.endsWith(".png") ? "image" : "video";
  const mediaUrl = await opts.upload(opts.assetPath, kind);
  await opts.post(opts.webhookUrl, buildQueueSubmission(opts.entry, opts.captions, mediaUrl, opts.runId));
  return { media_url: mediaUrl };
}

export async function sendTelegramSummary(
  tg: TelegramConfig,
  text: string,
  post: JsonPoster = defaultPoster,
): Promise<void> {
  await post(`https://api.telegram.org/bot${tg.botToken}/sendMessage`, { chat_id: tg.chatId, text });
}
