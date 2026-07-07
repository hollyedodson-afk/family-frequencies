export interface FactoryConfig {
  anthropicApiKey: string;
  claudeModel: string;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): FactoryConfig {
  const anthropicApiKey = env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set. Copy .env.example to .env and fill it in.");
  }
  return {
    anthropicApiKey,
    claudeModel: env.CLAUDE_MODEL || "claude-sonnet-4-6",
  };
}
