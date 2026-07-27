import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getAuthContext, NoOrganizationError, UnauthorizedError } from "@/server/auth";
import { isClerkConfigured } from "@/lib/env";
import { AppShell } from "@/components/layout/app-shell";
import {
  AccessPendingScreen,
  NoOrganizationScreen,
} from "@/components/layout/access-gate";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/sign-in");
    // A signed-in user with no organization sees an explanatory screen.
    if (error instanceof NoOrganizationError) return <NoOrganizationScreen />;
    // Next.js replaces server errors with an opaque digest in production, so
    // log the real cause here or a broken deployment is undiagnosable.
    // `/api/diagnostics` reports the same failure over HTTP.
    console.error("[voicesheets] Auth context failed in app layout:", error);
    throw error;
  }

  // Entitlement gate: only ACTIVE orgs reach the app. Super-admins bypass it
  // so they can view any organization for support.
  if (ctx.accessStatus !== "ACTIVE" && !ctx.isSuperAdmin) {
    return <AccessPendingScreen status={ctx.accessStatus} />;
  }

  return (
    <AppShell
      clerkEnabled={isClerkConfigured()}
      isSuperAdmin={ctx.isSuperAdmin}
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
