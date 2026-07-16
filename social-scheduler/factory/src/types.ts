import { z } from "zod";

export const EventFactsSchema = z.object({
  date: z.string(),
  venue: z.string(),
  time: z.string().optional(),
  cost: z.string().optional(),
});

export const CyclePlanEntrySchema = z.object({
  // recipe_id becomes a filename inside an ffmpeg filtergraph — keep it path/filter-safe
  recipe_id: z.string().regex(/^[A-Za-z0-9._-]+$/, "recipe_id: letters, digits, dot, underscore, hyphen only"),
  pillar: z.string(),
  frame_or_painting: z.enum(["frame", "painting"]),
  type: z.enum(["feed", "story", "carousel", "reel"]),
  template: z.string().nullable().optional(),
  hook: z.string(),
  source: z.enum(["render", "clip", "footage"]),
  scheduled_at: z.string(),
  footage_file: z.string().optional(),
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

export interface TranscriptSegment {
  start_ms: number;
  end_ms: number;
  text: string;
}

export const HighlightWindowSchema = z
  .object({
    start_ms: z.number().int().nonnegative(),
    end_ms: z.number().int().positive(),
    reason: z.string(),
  })
  .refine((w) => w.end_ms > w.start_ms, { message: "end_ms must be after start_ms" });

export type HighlightWindow = z.infer<typeof HighlightWindowSchema>;

export function parseHighlightWindows(input: unknown, durationMs: number): HighlightWindow[] {
  const windows = z.array(HighlightWindowSchema).parse(input);
  for (const w of windows) {
    if (w.end_ms > durationMs) {
      throw new Error(`highlight window ${w.start_ms}–${w.end_ms}ms exceeds video duration ${durationMs}ms`);
    }
  }
  return windows;
}

/** Body accepted by WF01 ff-submit-post webhook. Row lands as status=draft. */
export interface QueueSubmission {
  type: string;
  caption: string;
  media_url: string;
  scheduled_at: string;
  needs_music: boolean;
  notes: string;
}

export interface RunReportItem {
  recipe_id: string;
  asset: string | null;
  media_url: string | null;
  published: boolean;
  skipped: boolean;
  errors: string[];
}

export interface RunReport {
  run_id: string;
  items: RunReportItem[];
}
