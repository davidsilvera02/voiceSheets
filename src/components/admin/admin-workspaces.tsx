"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Building2, Check, Clock, ShieldX } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";

type AccessStatus = "PENDING" | "ACTIVE" | "SUSPENDED";

interface AdminWorkspaceRow {
  id: string;
  name: string;
  clerkOrgId: string | null;
  accessStatus: AccessStatus;
  activatedAt: string | null;
  createdAt: string;
  memberCount: number;
  spreadsheetCount: number;
  templateCount: number;
  ownerEmail: string | null;
  lastActivityAt: string | null;
}

const STATUS_BADGE: Record<AccessStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ACTIVE: { label: "Active", variant: "default" },
  PENDING: { label: "Pending", variant: "secondary" },
  SUSPENDED: { label: "Suspended", variant: "destructive" },
};

export function AdminWorkspaces() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["admin", "workspaces"],
    queryFn: () => apiGet<AdminWorkspaceRow[]>("/api/admin/workspaces"),
  });

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AccessStatus }) =>
      apiPost(`/api/admin/workspaces/${id}/access`, { status }),
    onSuccess: (_data, variables) => {
      toast.success(
        variables.status === "ACTIVE"
          ? "Access granted"
          : variables.status === "SUSPENDED"
            ? "Access suspended"
            : "Reset to pending",
      );
      qc.invalidateQueries({ queryKey: ["admin", "workspaces"] });
    },
    onError: (error: Error) => toast.error(error.message || "Update failed"),
  });

  if (query.isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <p className="text-sm text-destructive">
        Could not load organizations: {(query.error as Error).message}
      </p>
    );
  }

  const rows = query.data ?? [];
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="No organizations yet"
        description="Organizations appear here as soon as their members first sign in."
      />
    );
  }

  const pending = mutation.isPending ? mutation.variables?.id : undefined;

  return (
    <div className="overflow-x-auto rounded-xl border bg-card shadow-soft">
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3 font-medium">Organization</th>
            <th className="px-4 py-3 font-medium">Owner</th>
            <th className="px-4 py-3 font-medium">Members</th>
            <th className="px-4 py-3 font-medium">Sheets</th>
            <th className="px-4 py-3 font-medium">Last activity</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((w) => {
            const badge = STATUS_BADGE[w.accessStatus];
            const busy = pending === w.id;
            return (
              <tr key={w.id} className="border-b last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium">{w.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {w.clerkOrgId ? `org: ${w.clerkOrgId}` : "personal / dev"}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{w.ownerEmail ?? "—"}</td>
                <td className="px-4 py-3 tabular-nums">{w.memberCount}</td>
                <td className="px-4 py-3 tabular-nums">{w.spreadsheetCount}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {w.lastActivityAt
                    ? formatDistanceToNow(new Date(w.lastActivityAt), { addSuffix: true })
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    {w.accessStatus !== "ACTIVE" && (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => mutation.mutate({ id: w.id, status: "ACTIVE" })}
                      >
                        <Check className="h-3.5 w-3.5" /> Activate
                      </Button>
                    )}
                    {w.accessStatus === "ACTIVE" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => mutation.mutate({ id: w.id, status: "SUSPENDED" })}
                      >
                        <ShieldX className="h-3.5 w-3.5" /> Suspend
                      </Button>
                    )}
                    {w.accessStatus === "SUSPENDED" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => mutation.mutate({ id: w.id, status: "PENDING" })}
                      >
                        <Clock className="h-3.5 w-3.5" /> Reset
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
