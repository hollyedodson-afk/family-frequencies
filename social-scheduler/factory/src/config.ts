export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export interface FactoryConfig {
  anthropicApiKey: string;
  claudeModel: string;
  /** undefined when CLOUDINARY_* not set — publish stage will refuse to run */
  cloudinary?: CloudinaryConfig;
  /** undefined when TELEGRAM_* not set — batch summary skipped */
  telegram?: TelegramConfig;
  submitWebhookUrl: string;
  whisperModelPath: string;
}

const DEFAULT_SUBMIT_WEBHOOK = "https://n8n-production-4a398.up.railway.app/webhook/ff-submit-post";

export function loadConfig(env: Record<string, string | undefined> = process.env): FactoryConfig {
  const anthropicApiKey = env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set. Copy .env.example to .env and fill it in.");
  }
  const cloudinary =
    env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
      ? { cloudName: env.CLOUDINARY_CLOUD_NAME, apiKey: env.CLOUDINARY_API_KEY, apiSecret: env.CLOUDINARY_API_SECRET }
      : undefined;
  const telegram =
    env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID
      ? { botToken: env.TELEGRAM_BOT_TOKEN, chatId: env.TELEGRAM_CHAT_ID }
      : undefined;
  return {
    anthropicApiKey,
    claudeModel: env.CLAUDE_MODEL || "claude-sonnet-4-6",
    cloudinary,
    telegram,
    submitWebhookUrl: env.N8N_SUBMIT_WEBHOOK || DEFAULT_SUBMIT_WEBHOOK,
    whisperModelPath: env.WHISPER_MODEL_PATH || "models/ggml-base.en.bin",
  };
}
