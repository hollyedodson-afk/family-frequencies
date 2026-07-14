import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SUBDIRS = ["clips", "stills", "captions", "transcripts", "done"] as const;
type Subdir = (typeof SUBDIRS)[number];

/**
 * work/<run-id>/ staging. Artefacts are keyed by recipe_id + stage; a
 * `done/<recipe>.<stage>` marker means that artefact is complete, so re-runs
 * skip it. Nothing in here is ever the live queue — publish reads from it.
 */
export class Staging {
  readonly dir: string;

  constructor(workRoot: string, runId: string) {
    this.dir = join(workRoot, runId);
    for (const d of SUBDIRS) mkdirSync(join(this.dir, d), { recursive: true });
  }

  path(sub: Subdir, file: string): string {
    return join(this.dir, sub, file);
  }

  isDone(recipeId: string, stage: string): boolean {
    return existsSync(this.markerPath(recipeId, stage));
  }

  markDone(recipeId: string, stage: string): void {
    writeFileSync(this.markerPath(recipeId, stage), new Date().toISOString());
  }

  private markerPath(recipeId: string, stage: string): string {
    return join(this.dir, "done", `${recipeId}.${stage}`);
  }
}
