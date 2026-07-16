import { spawnSync } from "node:child_process";

const INSTALL_HINTS: Record<string, string> = {
  ffmpeg: "brew install ffmpeg",
  "whisper-cli": "brew install whisper-cpp",
};

export type WhichFn = (bin: string) => boolean;

export const defaultWhich: WhichFn = (bin) =>
  spawnSync("which", [bin], { stdio: "ignore" }).status === 0;

export function assertToolsAvailable(bins: string[], which: WhichFn = defaultWhich): void {
  const missing = bins.filter((b) => !which(b));
  if (missing.length === 0) return;
  const lines = missing.map((b) => `  ${b} — install with: ${INSTALL_HINTS[b] ?? `brew install ${b}`}`);
  throw new Error(`Missing required tools:\n${lines.join("\n")}`);
}
