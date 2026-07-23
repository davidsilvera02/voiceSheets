import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env, isClerkConfigured } from "@/lib/env";
import { getAuthContext, UnauthorizedError } from "@/server/auth";

export const dynamic = "force-dynamic";

/**
 * Deployment self-check.
 *
 * Server Component failures on Vercel surface only as an opaque "Digest: …",
 * which makes a broken deployment nearly impossible to diagnose from the
 * outside. This endpoint walks the exact same steps the authenticated layout
 * performs and reports which one fails, with the real error message.
 *
 * It deliberately reports NO secret values — only presence, key *prefixes*
 * (pk_test / sk_live …), and the database host. Every response string is run
 * through `scrub()`, which removes any literal secret that leaked into an
 * upstream error message.
 */

/** Secret values that must never appear in the response, even inside errors. */
function secretValues(): string[] {
  return [
    env.CLERK_SECRET_KEY,
    env.ANTHROPIC_API_KEY,
    env.OPENAI_API_KEY,
    // The database password, extracted from the connection string.
    (() => {
      try {
        return new URL(env.DATABASE_URL).password;
      } catch {
        return "";
      }
    })(),
  ].filter((value) => value.length > 6);
}

function scrub(value: string): string {
  let out = value;
  for (const secret of secretValues()) out = out.split(secret).join("«redacted»");
  return out;
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as { code?: string }).code;
    const head = `${error.name}${code ? ` [${code}]` : ""}: ${error.message}`;
    return scrub(head).split("\n").slice(0, 6).join(" | ");
  }
  return scrub(String(error));
}

/** Run a labelled check, capturing failures instead of throwing. */
async function check<T>(name: string, fn: () => Promise<T>) {
  const started = Date.now();
  try {
    const value = await fn();
    return { name, ok: true as const, ms: Date.now() - started, value };
  } catch (error) {
    return { name, ok: false as const, ms: Date.now() - started, error: describeError(error) };
  }
}

/** Connection-string summary with credentials stripped. */
function describeDatabaseUrl(): Record<string, unknown> {
  if (!env.DATABASE_URL) return { present: false };
  try {
    const url = new URL(env.DATABASE_URL);
    return {
      present: true,
      host: url.hostname,
      port: url.port || "(default 5432)",
      database: url.pathname.replace(/^\//, ""),
      params: Object.fromEntries(url.searchParams.entries()),
      // The Vercel runtime needs the *transaction* pooler (port 6543).
      looksLikeTransactionPooler:
        url.port === "6543" && url.searchParams.get("pgbouncer") === "true",
    };
  } catch {
    return { present: true, parseable: false };
  }
}

function keyKind(key: string): string {
  if (!key) return "missing";
  const prefix = key.slice(0, key.indexOf("_") + 1);
  return `${prefix || "?"}… (${key.length} chars)`;
}

export async function GET() {
  const checks: unknown[] = [];

  // 1. Can Prisma reach the database at all?
  checks.push(await check("database.query", async () => {
    await prisma.$queryRaw`SELECT 1`;
    return "reachable";
  }));

  // 2. Is the schema actually pushed to this database?
  checks.push(await check("database.schema", async () => {
    const [users, workspaces, templates] = await Promise.all([
      prisma.user.count(),
      prisma.workspace.count(),
      prisma.template.count(),
    ]);
    return { users, workspaces, templates };
  }));

  // 3. Does Clerk resolve the current session? (Only when Clerk is active.)
  if (isClerkConfigured()) {
    checks.push(await check("clerk.auth", async () => {
      const { auth } = await import("@clerk/nextjs/server");
      const { userId, sessionId } = auth();
      return { userId: userId ? "present" : "none", sessionId: sessionId ? "present" : "none" };
    }));

    checks.push(await check("clerk.backendApi", async () => {
      const { clerkClient } = await import("@clerk/nextjs/server");
      const list = await clerkClient().users.getUserList({ limit: 1 });
      return { reachable: true, totalUsers: list.totalCount };
    }));
  }

  // 4. The real thing: the exact call the app layout makes.
  checks.push(await check("auth.getAuthContext", async () => {
    try {
      const ctx = await getAuthContext();
      return { userId: ctx.user.id, workspaceId: ctx.workspace.id, role: ctx.role };
    } catch (error) {
      if (error instanceof UnauthorizedError) return "not signed in (expected when signed out)";
      throw error;
    }
  }));

  const failures = checks.filter((c) => !(c as { ok: boolean }).ok);

  return NextResponse.json(
    {
      summary: failures.length === 0 ? "all checks passed" : `${failures.length} check(s) failed`,
      runtime: {
        nodeEnv: env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV ?? "(not on vercel)",
        appUrl: env.APP_URL,
      },
      config: {
        database: describeDatabaseUrl(),
        clerkPublishableKey: keyKind(env.CLERK_PUBLISHABLE_KEY),
        clerkSecretKey: keyKind(env.CLERK_SECRET_KEY),
        clerkActive: isClerkConfigured(),
        forceDevAuth: env.FORCE_DEV_AUTH,
        anthropicKey: env.ANTHROPIC_API_KEY ? "set" : "missing",
        anthropicModel: env.ANTHROPIC_MODEL,
        openaiKey: env.OPENAI_API_KEY ? "set" : "missing",
      },
      checks,
    },
    { status: failures.length === 0 ? 200 : 500 },
  );
}
