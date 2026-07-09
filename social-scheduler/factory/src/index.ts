import "dotenv/config";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { parseCyclePlan, type CaptionSet } from "./types.ts";
import { loadConfig } from "./config.ts";
import { loadRegistry, getTemplate } from "./templates.ts";
import { renderStill } from "./render-stills.ts";
import { writeCopy, makeAnthropicCaller } from "./write-copy.ts";

interface OutputRecord {
  recipe_id: string;
  type: string;
  pngPath: string | null;
  captions: CaptionSet | null;
  scheduled_at: string;
  errors: string[];
}

async function main() {
  const { values } = parseArgs({ options: { plan: { type: "string" }, out: { type: "string" } } });
  const planPath = values.plan;
  if (!planPath) throw new Error("Usage: npm run factory -- --plan <cycle-plan.json> [--out out]");
  const outDir = values.out ?? "out";
  mkdirSync(outDir, { recursive: true });

  const cfg = loadConfig();
  const registry = loadRegistry();
  const caller = makeAnthropicCaller(cfg);
  const plan = parseCyclePlan(JSON.parse(readFileSync(planPath, "utf8")));

  const results: OutputRecord[] = [];
  for (const entry of plan) {
    const rec: OutputRecord = { recipe_id: entry.recipe_id, type: entry.type, pngPath: null, captions: null, scheduled_at: entry.scheduled_at, errors: [] };

    if (entry.source === "render" && entry.template) {
      try {
        const spec = getTemplate(registry, entry.template);
        const data: Record<string, string> = {};
        if (entry.event_facts) {
          data.date = entry.event_facts.date;
          data.venue = entry.event_facts.venue;
          if (entry.event_facts.time) data.time = entry.event_facts.time;
          if (entry.event_facts.cost) data.cost = entry.event_facts.cost;
        }
        rec.pngPath = await renderStill({ spec, data, outPath: join(outDir, `${entry.recipe_id}.png`) });
      } catch (e) {
        rec.errors.push(`render: ${(e as Error).message}`);
      }
    } else {
      rec.errors.push(`skipped render: source=${entry.source} (video/footage is Plan 2)`);
    }

    try {
      rec.captions = await writeCopy(entry, caller);
    } catch (e) {
      rec.errors.push(`copy: ${(e as Error).message}`);
    }

    results.push(rec);
    console.log(`• ${entry.recipe_id}: ${rec.pngPath ? "png ✓" : "png –"} ${rec.captions ? "copy ✓" : "copy –"} ${rec.errors.length ? "(" + rec.errors.join("; ") + ")" : ""}`);
  }

  writeFileSync(join(outDir, "index.json"), JSON.stringify(results, null, 2));
  const ok = results.filter((r) => r.errors.length === 0).length;
  console.log(`\nDone: ${ok}/${results.length} clean. Assets in ${outDir}/`);
}

main().catch((e) => { console.error(e); process.exit(1); });
