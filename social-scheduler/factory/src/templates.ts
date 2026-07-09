import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
export const TEMPLATES_DIR = join(here, "..", "templates");

export interface TemplateSpec {
  file: string;
  fields: string[];
  type: string;
  aspect: string;
  width: number;
  height: number;
}

export type Registry = Record<string, TemplateSpec>;

export function loadRegistry(dir: string = TEMPLATES_DIR): Registry {
  const raw = readFileSync(join(dir, "registry.json"), "utf8");
  return JSON.parse(raw) as Registry;
}

export function getTemplate(reg: Registry, key: string): TemplateSpec {
  const spec = reg[key];
  if (!spec) throw new Error(`Unknown template: ${key}`);
  return spec;
}
