import Anthropic from "@anthropic-ai/sdk";
import type { CaptionSet, CyclePlanEntry } from "./types.ts";
import type { FactoryConfig } from "./config.ts";

const FF_VOICE = `You write social captions for Family Frequencies (FF), a parent brand running "daytime club culture for families" in Mt Maunganui / Tauranga, NZ. Daylight Disco is one offering: FREE, walk-in, no tickets. Voice: cool party parents — warm, a little cheeky, aesthetic-led, Kiwi, never twee, never corporate, never a council noticeboard. Short lines. Never invent ticket sales or urgency (events are free). Use 3–5 tight hashtags, always including #FamilyFrequencies and #DaylightDisco.`;

export function buildCaptionPrompt(entry: CyclePlanEntry): string {
  const facts = entry.event_facts
    ? `Event facts: ${entry.event_facts.date}, ${entry.event_facts.venue}, ${entry.event_facts.time ?? ""}, cost ${entry.event_facts.cost ?? "free"}.`
    : "No specific event facts.";
  return [
    FF_VOICE,
    `Pillar: ${entry.pillar}. Post type: ${entry.type}.`,
    `Hook (opening line / on-screen): "${entry.hook}".`,
    facts,
    `Write three captions for this post: one for Instagram (warm + a clear CTA), one for TikTok (keyword-y, casual, search-friendly — include plain terms like "family day out Mount Maunganui"), one for Facebook (community + mentions it's free/walk-in).`,
    `Return ONLY a JSON object with keys "instagram", "tiktok", "facebook" and string values. No markdown, no commentary.`,
  ].join("\n\n");
}

export type CaptionCaller = (prompt: string) => Promise<string>;

export function makeAnthropicCaller(cfg: FactoryConfig): CaptionCaller {
  const client = new Anthropic({ apiKey: cfg.anthropicApiKey });
  return async (prompt: string) => {
    const msg = await client.messages.create({
      model: cfg.claudeModel,
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });
    const block = msg.content.find((b) => b.type === "text");
    return block && block.type === "text" ? block.text : "{}";
  };
}

export async function writeCopy(entry: CyclePlanEntry, caller: CaptionCaller): Promise<CaptionSet> {
  const raw = await caller(buildCaptionPrompt(entry));
  const jsonStart = raw.indexOf("{");
  const jsonEnd = raw.lastIndexOf("}");
  const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as CaptionSet;
  return {
    instagram: parsed.instagram ?? "",
    tiktok: parsed.tiktok ?? "",
    facebook: parsed.facebook ?? "",
  };
}
