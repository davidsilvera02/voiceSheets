"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Building2, Check, Clock, ShieldCheck, ShieldX, Trash2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiDelete, apiGet, apiPost } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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

const STATUS_META: Record<
  AccessStatus,
  { section: string; hint: string; icon: typeof Building2; iconClass: string; dot: string }
> = {
  PENDING: {
    section: "Pending activation",
    hint: "New organizations waiting for you to grant access.",
    icon: Clock,
    iconClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  ACTIVE: {
    section: "Active",
    hint: "Organizations with access to the app.",
    icon: ShieldCheck,
    iconClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  SUSPENDED: {
    section: "Suspended",
    hint: "Access revoked — reactivate or delete.",
    icon: ShieldX,
    iconClass: "bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
};

const SECTION_ORDER: AccessStatus[] = ["PENDING", "ACTIVE", "SUSPENDED"];

export function AdminWorkspaces() {
  const qc = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<AdminWorkspaceRow | null>(null);
  const query = useQuery({
    queryKey: ["admin", "workspaces"],
    queryFn: () => apiGet<AdminWorkspaceRow[]>("/api/admin/workspaces"),
  });

  const setAccess = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AccessStatus }) =>
      apiPost(`/api/admin/workspaces/${id}/access`, { status }),
    onSuccess: (_data, variables) => {
      toast.success(
        variables.status === "ACTIVE"
          ? "Access granted"
          : variables.status === "SUSPENDED"
            ? "Access revoked"
            : "Reset to pending",
      );
      qc.invalidateQueries({ queryKey: ["admin", "workspaces"] });
    },
    onError: (error: Error) => toast.error(error.message || "Update failed"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/admin/workspaces/${id}`),
    onSuccess: () => {
      toast.success("Organization removed");
      qc.invalidateQueries({ queryKey: ["admin", "workspaces"] });
    },
    onError: (error: Error) => toast.error(error.message || "Delete failed"),
  });

  if (query.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[68px] w-full rounded-xl" />
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

  const busyId =
    (setAccess.isPending && setAccess.variables?.id) ||
    (remove.isPending && remove.variables) ||
    undefined;

  const grouped = SECTION_ORDER.map((status) => ({
    status,
    items: rows.filter((r) => r.accessStatus === status),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-8">
      {grouped.map(({ status, items }) => {
        const meta = STATUS_META[status];
        return (
          <section key={status} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
              <h2 className="text-sm font-semibold">{meta.section}</h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {items.length}
              </span>
              <p className="ml-1 hidden text-xs text-muted-foreground sm:block">{meta.hint}</p>
            </div>
            <div className="space-y-2">
              {items.map((w) => (
                <WorkspaceRow
                  key={w.id}
                  workspace={w}
                  busy={busyId === w.id}
                  onSetAccess={(s) => setAccess.mutate({ id: w.id, status: s })}
                  onDelete={() => setDeleteTarget(w)}
                />
              ))}
            </div>
          </section>
        );
      })}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Delete "${deleteTarget?.name}"?`}
        description="This permanently deletes this organization's workspace and all its templates, spreadsheets, and rows. If the organization still exists in Clerk and its members sign in again, a fresh pending workspace will be created."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (deleteTarget) await remove.mutateAsync(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}

function WorkspaceRow({
  workspace: w,
  busy,
  onSetAccess,
  onDelete,
}: {
  workspace: AdminWorkspaceRow;
  busy: boolean;
  onSetAccess: (status: AccessStatus) => void;
  onDelete: () => void;
}) {
  const meta = STATUS_META[w.accessStatus];
  const Icon = meta.icon;
  const metaBits = [
    w.ownerEmail,
    `${w.memberCount} member${w.memberCount === 1 ? "" : "s"}`,
    `${w.spreadsheetCount} sheet${w.spreadsheetCount === 1 ? "" : "s"}`,
    w.lastActivityAt
      ? `active ${formatDistanceToNow(new Date(w.lastActivityAt), { addSuffix: true })}`
      : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-3.5 shadow-soft transition-colors hover:border-border sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            meta.iconClass,
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {w.name}
            {!w.clerkOrgId && (
              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
                personal
              </span>
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground">{metaBits.join(" · ")}</p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:justify-end">
        {w.accessStatus !== "ACTIVE" && (
          <Button size="sm" disabled={busy} onClick={() => onSetAccess("ACTIVE")}>
            <Check className="h-3.5 w-3.5" /> Activate
          </Button>
        )}
        {w.accessStatus === "PENDING" && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => onSetAccess("SUSPENDED")}>
            <XCircle className="h-3.5 w-3.5" /> Reject
          </Button>
        )}
        {w.accessStatus === "ACTIVE" && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => onSetAccess("SUSPENDED")}>
            <ShieldX className="h-3.5 w-3.5" /> Suspend
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground hover:text-destructive"
          disabled={busy}
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
      </div>
    </div>
  );
}
