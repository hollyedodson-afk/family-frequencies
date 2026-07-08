import { z } from "zod";

export const EventFactsSchema = z.object({
  date: z.string(),
  venue: z.string(),
  time: z.string().optional(),
  cost: z.string().optional(),
});

export const CyclePlanEntrySchema = z.object({
  recipe_id: z.string(),
  pillar: z.string(),
  frame_or_painting: z.enum(["frame", "painting"]),
  type: z.enum(["feed", "story", "carousel", "reel"]),
  template: z.string().nullable().optional(),
  hook: z.string(),
  source: z.enum(["render", "clip", "footage"]),
  scheduled_at: z.string(),
  event_facts: EventFactsSchema.optional(),
});

export type EventFacts = z.infer<typeof EventFactsSchema>;
export type CyclePlanEntry = z.infer<typeof CyclePlanEntrySchema>;

export function parseCyclePlan(input: unknown): CyclePlanEntry[] {
  return z.array(CyclePlanEntrySchema).parse(input);
}

export interface CaptionSet {
  instagram: string;
  tiktok: string;
  facebook: string;
}
