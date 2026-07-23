"use client";

import { formatDistanceToNow } from "date-fns";
import { History, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { useRestoreRow, useSpreadsheetHistory } from "@/hooks/use-history";
import type { HistoryEntryDTO } from "@/lib/types";

const CHANGE_LABEL: Record<HistoryEntryDTO["changeType"], string> = {
  CREATE: "Row created",
  UPDATE: "Row edited",
  DELETE: "Row deleted",
  RESTORE: "Row restored",
  IMPORT: "Row imported",
};

const CHANGE_VARIANT: Record<HistoryEntryDTO["changeType"], "default" | "secondary" | "destructive" | "outline"> = {
  CREATE: "secondary",
  UPDATE: "outline",
  DELETE: "destructive",
  RESTORE: "default",
  IMPORT: "secondary",
};

function preview(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${v ?? "—"}`)
      .join(", ");
  }
  return String(value);
}

export function VersionHistoryDialog({
  open,
  onOpenChange,
  spreadsheetId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  spreadsheetId: string;
}) {
  const { data, isLoading } = useSpreadsheetHistory(spreadsheetId, open);
  const restore = useRestoreRow(spreadsheetId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Version history</DialogTitle>
          <DialogDescription>
            Every change is recorded. Restore any row to a previous state.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-3">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !data || data.data.length === 0 ? (
            <EmptyState icon={History} title="No history yet" description="Edits will appear here." />
          ) : (
            <div className="space-y-2">
              {data.data.map((entry) => (
                <div key={entry.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant={CHANGE_VARIANT[entry.changeType]} className="font-normal">
                      {CHANGE_LABEL[entry.changeType]}
                    </Badge>
                    {entry.columnKey && (
                      <span className="text-xs text-muted-foreground">· {entry.columnKey}</span>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {entry.actorName ? `${entry.actorName} · ` : ""}
                      {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  {(entry.previousValue != null || entry.newValue != null) && (
                    <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                      <div className="rounded bg-destructive/5 px-2 py-1">
                        <span className="font-medium text-destructive">Before: </span>
                        {preview(entry.previousValue)}
                      </div>
                      <div className="rounded bg-emerald-500/5 px-2 py-1">
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">After: </span>
                        {preview(entry.newValue)}
                      </div>
                    </div>
                  )}
                  {entry.rowId && entry.snapshot && (
                    <div className="mt-2 flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={restore.isPending}
                        onClick={async () => {
                          await restore.mutateAsync({ rowId: entry.rowId!, historyId: entry.id });
                          toast.success("Row restored to this version");
                        }}
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Restore this version
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
