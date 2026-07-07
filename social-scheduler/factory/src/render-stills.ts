import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { TEMPLATES_DIR, type TemplateSpec } from "./templates.ts";

export interface RenderStillArgs {
  spec: TemplateSpec;
  data: Record<string, string>;
  outPath: string;
}

export async function renderStill({ spec, data, outPath }: RenderStillArgs): Promise<string> {
  mkdirSync(dirname(outPath), { recursive: true });

  const fileUrl = pathToFileURL(join(TEMPLATES_DIR, spec.file));
  const params = new URLSearchParams();
  for (const key of spec.fields) {
    if (data[key] != null) params.set(key, data[key]);
  }
  fileUrl.search = params.toString();

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: spec.width, height: spec.height } });
    await page.goto(fileUrl.toString(), { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.body.getAttribute("data-fonts-ready") === "1", null, { timeout: 10000 }).catch(() => {});
    const abs = resolve(outPath);
    await page.screenshot({ path: abs, clip: { x: 0, y: 0, width: spec.width, height: spec.height } });
    return abs;
  } finally {
    await browser.close();
  }
}
