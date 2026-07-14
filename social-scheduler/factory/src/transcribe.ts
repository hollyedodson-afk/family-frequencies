import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import type { TranscriptSegment } from "./types.ts";

export type SubprocessRunner = (bin: string, args: string[]) => Promise<void>;

export const defaultRunner: SubprocessRunner = (bin, args) =>
  new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${bin} exited ${code}: ${err.slice(-400)}`)),
    );
    p.on("error", reject);
  });

interface WhisperJson {
  transcription: Array<{ offsets: { from: number; to: number }; text: string }>;
}

export function parseWhisperJson(raw: string): TranscriptSegment[] {
  const parsed = JSON.parse(raw) as WhisperJson;
  if (!Array.isArray(parsed.transcription)) {
    throw new Error("whisper output has no transcription array");
  }
  return parsed.transcription.map((s) => ({
    start_ms: s.offsets.from,
    end_ms: s.offsets.to,
    text: s.text.trim(),
  }));
}

const DEFAULT_MODEL = "models/ggml-base.en.bin";

/**
 * videoPath → TranscriptSegment[]. Writes <outBase>.wav and <outBase>.json
 * (whisper's -of output). modelPath comes from config (WHISPER_MODEL_PATH).
 */
export async function transcribe(
  videoPath: string,
  outBase: string,
  runner: SubprocessRunner = defaultRunner,
  modelPath: string = DEFAULT_MODEL,
): Promise<TranscriptSegment[]> {
  const wav = `${outBase}.wav`;
  await runner("ffmpeg", ["-y", "-i", videoPath, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav]);
  await runner("whisper-cli", ["-m", modelPath, "-f", wav, "-oj", "-of", outBase, "-np"]);
  return parseWhisperJson(readFileSync(`${outBase}.json`, "utf8"));
}
