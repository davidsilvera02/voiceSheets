"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { RowSelectionState } from "@tanstack/react-table";
import { toast } from "sonner";
import type { CellValue } from "@/lib/columns";
import { exportSpreadsheet, type ExportFormat } from "@/lib/export";
import type { RowDTO, SpreadsheetDTO } from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { Pencil, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SpreadsheetToolbar } from "@/components/spreadsheet/spreadsheet-toolbar";
import { DataGrid } from "@/components/spreadsheet/data-grid";
import { ManualEntryDialog } from "@/components/spreadsheet/manual-entry-dialog";
import { BulkEditDialog } from "@/components/spreadsheet/bulk-edit-dialog";
import { VersionHistoryDialog } from "@/components/spreadsheet/version-history-dialog";
import { VoiceEntryDialog } from "@/components/voice/voice-entry-dialog";
import { ImportDialog } from "@/components/spreadsheet/import-dialog";
import {
  useSpreadsheet,
  useUpdateSpreadsheet,
  useDeleteSpreadsheet,
  useDuplicateSpreadsheet,
} from "@/hooks/use-spreadsheets";
import {
  useRows,
  useCreateRow,
  useUpdateRow,
  useDeleteRow,
  useBulkDeleteRows,
} from "@/hooks/use-rows";
import { ApiClientError } from "@/lib/api-client";

interface EditOp {
  rowId: string;
  columnKey: string;
  prev: CellValue;
  next: CellValue;
}

export function SpreadsheetView({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sheetQuery = useSpreadsheet(id);
  const rowsQuery = useRows(id);
  const updateSheet = useUpdateSpreadsheet(id);
  const deleteSheet = useDeleteSpreadsheet();
  const duplicateSheet = useDuplicateSpreadsheet();
  const createRow = useCreateRow(id);
  const updateRow = useUpdateRow(id);
  const deleteRow = useDeleteRow(id);
  const bulkDelete = useBulkDeleteRows(id);

  const [search, setSearch] = useState("");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const [addOpen, setAddOpen] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  // Deep link: /spreadsheets/[id]?voice=1 opens voice entry straight away.
  useEffect(() => {
    if (searchParams.get("voice") === "1") setVoiceOpen(true);
  }, [searchParams]);
  const [importOpen, setImportOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  const [undoStack, setUndoStack] = useState<EditOp[]>([]);
  const [redoStack, setRedoStack] = useState<EditOp[]>([]);

  const sheet = sheetQuery.data;
  const rows = useMemo<RowDTO[]>(() => rowsQuery.data?.data ?? [], [rowsQuery.data]);
  const allColumns = sheet?.columns ?? [];
  const visibleColumns = useMemo(
    () => allColumns.filter((c) => !c.hidden).sort((a, b) => a.position - b.position),
    [allColumns],
  );

  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k]);

  const applyEdit = useCallback(
    (rowId: string, columnKey: string, value: CellValue) => {
      updateRow.mutate({ rowId, values: { [columnKey]: value } });
    },
    [updateRow],
  );

  const handleUpdateCell = useCallback(
    (rowId: string, columnKey: string, value: CellValue) => {
      const current = rows.find((r) => r.id === rowId)?.values[columnKey] ?? null;
      if (JSON.stringify(current) === JSON.stringify(value)) return;
      setUndoStack((s) => [...s, { rowId, columnKey, prev: current, next: value }].slice(-100));
      setRedoStack([]);
      applyEdit(rowId, columnKey, value);
    },
    [rows, applyEdit],
  );

  const undo = useCallback(() => {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const op = stack[stack.length - 1]!;
      setRedoStack((r) => [...r, op]);
      applyEdit(op.rowId, op.columnKey, op.prev);
      return stack.slice(0, -1);
    });
  }, [applyEdit]);

  const redo = useCallback(() => {
    setRedoStack((stack) => {
      if (stack.length === 0) return stack;
      const op = stack[stack.length - 1]!;
      setUndoStack((u) => [...u, op]);
      applyEdit(op.rowId, op.columnKey, op.next);
      return stack.slice(0, -1);
    });
  }, [applyEdit]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement;
      const inField =
        el instanceof HTMLElement &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) &&
        !el.hasAttribute("data-grid-nav");
      if (inField) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  if (sheetQuery.isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (!sheet) {
    return <div className="p-6 text-sm text-muted-foreground">Spreadsheet not found.</div>;
  }

  function handleExport(format: ExportFormat) {
    exportSpreadsheet(sheet!.name, visibleColumns, rows, format);
    toast.success(`Exported ${rows.length} rows`);
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader
        title={
          <span className="group flex items-center gap-1">
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-md text-left hover:text-primary"
              title="Rename spreadsheet"
              onClick={() => {
                setRenameValue(sheet.name);
                setRenameOpen(true);
              }}
            >
              <span className="truncate">{sheet.name}</span>
              <Pencil className="h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title={sheet.isFavorite ? "Remove from favorites" : "Add to favorites"}
              onClick={() => updateSheet.mutate({ isFavorite: !sheet.isFavorite })}
            >
              <Star
                className={
                  sheet.isFavorite
                    ? "h-4 w-4 fill-amber-400 text-amber-400"
                    : "h-4 w-4 text-muted-foreground"
                }
              />
            </Button>
          </span>
        }
        description={
          <span>
            {sheet.templateName && <>Template: {sheet.templateName} · </>}
            {rows.length} rows
          </span>
        }
        actions={
          <Button variant="ghost" size="sm" onClick={() => router.push("/spreadsheets")}>
            All spreadsheets
          </Button>
        }
      />

      <SpreadsheetToolbar
        columns={allColumns}
        search={search}
        onSearchChange={setSearch}
        onToggleColumn={(key, hidden) => updateSheet.mutate({ columns: [{ key, hidden }] })}
        onAddRow={() => setAddOpen(true)}
        onVoiceEntry={() => setVoiceOpen(true)}
        onImport={() => setImportOpen(true)}
        onExport={handleExport}
        onRename={() => {
          setRenameValue(sheet.name);
          setRenameOpen(true);
        }}
        onDuplicate={async () => {
          const dup = await duplicateSheet.mutateAsync({ id, withRows: true });
          toast.success("Spreadsheet duplicated");
          router.push(`/spreadsheets/${dup.id}`);
        }}
        onDelete={() => setDeleteConfirm(true)}
        onOpenHistory={() => setHistoryOpen(true)}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onUndo={undo}
        onRedo={redo}
        selectedCount={selectedIds.length}
        onBulkEdit={() => setBulkEditOpen(true)}
        onBulkDelete={() => setBulkDeleteConfirm(true)}
        onClearSelection={() => setRowSelection({})}
      />

      {rowsQuery.isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <DataGrid
          columns={visibleColumns}
          rows={rows}
          search={search}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          onUpdateCell={handleUpdateCell}
          onDeleteRow={(rowId) => deleteRow.mutate(rowId)}
          onWidthCommit={(key, width) => updateSheet.mutate({ columns: [{ key, width }] })}
          onCreateRow={async (rowValues) => {
            try {
              await createRow.mutateAsync({ values: rowValues, source: "MANUAL" });
            } catch (error) {
              toast.error(
                error instanceof ApiClientError ? error.message : "Failed to add row",
              );
            }
          }}
        />
      )}

      <ManualEntryDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        spreadsheetId={id}
        columns={visibleColumns}
      />

      <VoiceEntryDialog
        open={voiceOpen}
        onOpenChange={setVoiceOpen}
        spreadsheetId={id}
        columns={visibleColumns}
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        spreadsheetId={id}
        columns={allColumns}
      />

      <BulkEditDialog
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
        spreadsheetId={id}
        columns={visibleColumns}
        rowIds={selectedIds}
        onDone={() => setRowSelection({})}
      />

      <VersionHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} spreadsheetId={id} />

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rename spreadsheet</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && renameValue.trim()) {
                updateSheet.mutate({ name: renameValue.trim() });
                setRenameOpen(false);
              }
            }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (renameValue.trim()) {
                  updateSheet.mutate({ name: renameValue.trim() });
                  setRenameOpen(false);
                }
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteConfirm}
        onOpenChange={setDeleteConfirm}
        title="Delete spreadsheet?"
        description="This permanently deletes the spreadsheet and all of its rows and history."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          await deleteSheet.mutateAsync(id);
          toast.success("Spreadsheet deleted");
          router.push("/spreadsheets");
        }}
      />

      <ConfirmDialog
        open={bulkDeleteConfirm}
        onOpenChange={setBulkDeleteConfirm}
        title={`Delete ${selectedIds.length} rows?`}
        description="The rows will be removed. You can restore individual rows from version history."
        confirmLabel="Delete rows"
        destructive
        onConfirm={async () => {
          await bulkDelete.mutateAsync(selectedIds);
          setRowSelection({});
          toast.success("Rows deleted");
        }}
      />
    </div>
  );
}
