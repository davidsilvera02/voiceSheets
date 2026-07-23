import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getAuthContext, UnauthorizedError } from "@/server/auth";
import { isClerkConfigured } from "@/lib/env";
import { AppShell } from "@/components/layout/app-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/sign-in");
    // Next.js replaces server errors with an opaque digest in production, so
    // log the real cause here or a broken deployment is undiagnosable.
    // `/api/diagnostics` reports the same failure over HTTP.
    console.error("[voicesheets] Auth context failed in app layout:", error);
    throw error;
  }

  return (
    <AppShell
      clerkEnabled={isClerkConfigured()}
      user={{
        name: ctx.user.name,
        email: ctx.user.email,
        imageUrl: ctx.user.imageUrl,
      }}
    >
      {children}
    </AppShell>
  );
}
