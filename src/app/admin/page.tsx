import { AdminWorkspaces } from "@/components/admin/admin-workspaces";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Organizations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Grant, revoke, or suspend each organization&apos;s access to VoiceSheets.
        </p>
      </div>
      <AdminWorkspaces />
    </div>
  );
}
