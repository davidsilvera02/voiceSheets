import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getActor, UnauthorizedError } from "@/server/auth";
import { VoiceSheetsMark } from "@/components/brand/voicesheets-mark";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  let actor;
  try {
    actor = await getActor();
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/sign-in");
    console.error("[voicesheets] Admin layout auth failed:", error);
    throw error;
  }
  // Only vendor super-admins may see the admin console.
  if (!actor.isSuperAdmin) redirect("/dashboard");

  return (
    <div className="vs-app-bg min-h-screen w-full bg-muted/40">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
        <div className="flex items-center gap-2">
          <VoiceSheetsMark className="h-6 w-6" />
          <span className="font-display text-base font-bold tracking-tight">
            VoiceSheets <span className="text-muted-foreground">Admin</span>
          </span>
        </div>
        <Link
          href="/dashboard"
          className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to app
        </Link>
      </header>
      <main className="mx-auto w-full max-w-6xl p-6">{children}</main>
    </div>
  );
}
