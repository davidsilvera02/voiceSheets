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

/** Parse a comma/space/newline-separated list into a clean lowercase array. */
function list(value: string | undefined): string[] {
  return str(value)
    .split(/[,\s]+/)
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

export const env = {
  DATABASE_URL: str(process.env.DATABASE_URL),
  APP_URL: str(process.env.NEXT_PUBLIC_APP_URL) || "http://localhost:3000",

  // Clerk
  CLERK_PUBLISHABLE_KEY: str(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
  CLERK_SECRET_KEY: str(process.env.CLERK_SECRET_KEY),

  // Anthropic
  ANTHROPIC_API_KEY: str(process.env.ANTHROPIC_API_KEY),
  // Haiku 4.5 is the fastest model and plenty for row extraction, which is a
  // simple, well-specified task. Override with ANTHROPIC_MODEL (e.g.
  // claude-sonnet-5 for more headroom, claude-opus-4-8 for max capability).
  ANTHROPIC_MODEL: str(process.env.ANTHROPIC_MODEL) || "claude-haiku-4-5",

  // OpenAI speech-to-text. Override with WHISPER_MODEL (e.g.
  // gpt-4o-mini-transcribe, which is faster).
  OPENAI_API_KEY: str(process.env.OPENAI_API_KEY),
  WHISPER_MODEL: str(process.env.WHISPER_MODEL) || "whisper-1",

  FORCE_DEV_AUTH: str(process.env.VOICESHEETS_FORCE_DEV_AUTH) === "true",
  NODE_ENV: process.env.NODE_ENV ?? "development",

  // Vendor super-admins: emails allowed into /admin to manage org access.
  // Comma-separated, e.g. VOICESHEETS_SUPER_ADMINS="me@acme.com,ops@acme.com".
  SUPER_ADMIN_EMAILS: list(process.env.VOICESHEETS_SUPER_ADMINS),
} as const;

/**
 * Whether the given email is a vendor super-admin (may manage app-wide access).
 * In dev-auth mode the single local user is always a super-admin so the admin
 * panel is reachable without any config.
 */
export function isSuperAdmin(email: string | null | undefined): boolean {
  if (env.FORCE_DEV_AUTH) return true;
  if (!email) return false;
  return env.SUPER_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

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
