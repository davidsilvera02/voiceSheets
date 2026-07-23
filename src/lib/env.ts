/**
 * Centralized, typed access to environment configuration.
 *
 * VoiceSheets deliberately treats Clerk, Anthropic, and Whisper as *optional*
 * integrations so the app runs end-to-end in local development without any
 * third-party accounts. Helper predicates below let the service layer decide
 * whether to use the real integration or a built-in fallback.
 */

function str(value: string | undefined): string {
  return (value ?? "").trim();
}

export const env = {
  DATABASE_URL: str(process.env.DATABASE_URL),
  APP_URL: str(process.env.NEXT_PUBLIC_APP_URL) || "http://localhost:3000",

  // Clerk
  CLERK_PUBLISHABLE_KEY: str(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
  CLERK_SECRET_KEY: str(process.env.CLERK_SECRET_KEY),

  // Anthropic
  ANTHROPIC_API_KEY: str(process.env.ANTHROPIC_API_KEY),
  // Sonnet 5 is the speed/quality sweet spot for row extraction.
  // Override with ANTHROPIC_MODEL (e.g. claude-haiku-4-5 for max speed,
  // claude-opus-4-8 for max capability).
  ANTHROPIC_MODEL: str(process.env.ANTHROPIC_MODEL) || "claude-sonnet-5",

  // Whisper (OpenAI)
  OPENAI_API_KEY: str(process.env.OPENAI_API_KEY),
  WHISPER_MODEL: str(process.env.WHISPER_MODEL) || "whisper-1",

  FORCE_DEV_AUTH: str(process.env.VOICESHEETS_FORCE_DEV_AUTH) === "true",
  NODE_ENV: process.env.NODE_ENV ?? "development",
} as const;

/** True when Clerk is fully configured and dev-auth is not forced. */
export function isClerkConfigured(): boolean {
  return (
    !env.FORCE_DEV_AUTH &&
    env.CLERK_PUBLISHABLE_KEY.length > 0 &&
    env.CLERK_SECRET_KEY.length > 0
  );
}

/** True when the Anthropic API can be called for real AI extraction. */
export function isAnthropicConfigured(): boolean {
  return env.ANTHROPIC_API_KEY.length > 0;
}

/** True when server-side Whisper transcription is available. */
export function isWhisperConfigured(): boolean {
  return env.OPENAI_API_KEY.length > 0;
}
