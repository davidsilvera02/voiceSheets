import type { AccessStatus } from "@prisma/client";
import { Building2, Clock, ShieldX } from "lucide-react";
import { VoiceSheetsMark } from "@/components/brand/voicesheets-mark";

function Shell({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="vs-app-bg flex min-h-screen w-full items-center justify-center bg-muted/40 p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-soft">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center">
          <VoiceSheetsMark className="h-9 w-9" />
        </div>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          {icon}
        </div>
        <h1 className="font-display text-xl font-bold tracking-tight">{title}</h1>
        <div className="mt-2 text-sm text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

/** Shown when a Clerk user isn't a member of any organization yet. */
export function NoOrganizationScreen() {
  return (
    <Shell icon={<Building2 className="h-5 w-5" />} title="No organization yet">
      <p>
        Your account isn&apos;t part of an organization. Ask your administrator to
        invite you, or contact Binaria Analytics to get your team set up.
      </p>
    </Shell>
  );
}

/** Shown when the organization's workspace access is not yet ACTIVE. */
export function AccessPendingScreen({ status }: { status: AccessStatus }) {
  if (status === "SUSPENDED") {
    return (
      <Shell icon={<ShieldX className="h-5 w-5" />} title="Access suspended">
        <p>
          Your organization&apos;s access to VoiceSheets is currently suspended.
          Please contact Binaria Analytics to restore it.
        </p>
      </Shell>
    );
  }
  return (
    <Shell icon={<Clock className="h-5 w-5" />} title="Access pending">
      <p>
        Your organization is set up and waiting to be activated. You&apos;ll be able
        to sign in as soon as access is granted. Thanks for your patience!
      </p>
    </Shell>
  );
}
