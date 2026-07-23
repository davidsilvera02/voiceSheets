"use client";

import { useMemo, useState } from "react";
import {
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { type CellValue, type ColumnDefinition, coerceValue, isEmpty } from "@/lib/columns";
import type { RowDTO } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GridCell, type NavDirection } from "@/components/spreadsheet/grid-cell";
import { ColumnStatsButton } from "@/components/spreadsheet/column-stats";

interface DataGridProps {
  columns: ColumnDefinition[];
  rows: RowDTO[];
  search: string;
  rowSelection: RowSelectionState;
  onRowSelectionChange: (updater: RowSelectionState) => void;
  onUpdateCell: (rowId: string, columnKey: string, value: CellValue) => void;
  onDeleteRow: (rowId: string) => void;
  onWidthCommit: (columnKey: string, width: number) => void;
  onCreateRow: (values: Record<string, CellValue>) => Promise<void> | void;
}

export function DataGrid({
  columns,
  rows,
  search,
  rowSelection,
  onRowSelectionChange,
  onUpdateCell,
  onDeleteRow,
  onWidthCommit,
  onCreateRow,
}: DataGridProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 50 });
  const [active, setActive] = useState<{ r: number; c: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [initialChar, setInitialChar] = useState<string | undefined>(undefined);
  const [widths, setWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(columns.map((c) => [c.key, c.width ?? 180])),
  );

  const tableColumns = useMemo<ColumnDef<RowDTO>[]>(
    () =>
      columns.map((col) => ({
        id: col.key,
        accessorFn: (row) => row.values[col.key] ?? "",
        header: col.name,
        enableSorting: true,
      })),
    [columns],
  );

  const table = useReactTable({
    data: rows,
    columns: tableColumns,
    state: { sorting, rowSelection, globalFilter: search, pagination },
    getRowId: (row) => row.id,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onRowSelectionChange: (updater) =>
      onRowSelectionChange(
        typeof updater === "function" ? updater(rowSelection) : updater,
      ),
    onGlobalFilterChange: () => {},
    globalFilterFn: "includesString",
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const pageRows = table.getRowModel().rows;

  function moveActive(dir: NavDirection) {
    setEditing(false);
    setActive((prev) => {
      if (!prev) return { r: 0, c: 0 };
      let { r, c } = prev;
      const maxR = pageRows.length - 1;
      const maxC = columns.length - 1;
      if (dir === "up") r = Math.max(0, r - 1);
      else if (dir === "down") r = Math.min(maxR, r + 1);
      else if (dir === "left") c = Math.max(0, c - 1);
      else if (dir === "right" || dir === "tab") {
        if (c < maxC) c += 1;
        else if (r < maxR) {
          c = 0;
          r += 1;
        }
      }
      return { r, c };
    });
  }

  function startResize(e: React.MouseEvent, columnKey: string) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = widths[columnKey] ?? 180;
    function onMove(ev: MouseEvent) {
      const next = Math.max(80, Math.min(1200, startWidth + ev.clientX - startX));
      setWidths((w) => ({ ...w, [columnKey]: next }));
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      setWidths((w) => {
        onWidthCommit(columnKey, w[columnKey] ?? 180);
        return w;
      });
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  const allSelected = table.getIsAllRowsSelected();
  const someSelected = table.getIsSomeRowsSelected();

  return (
    <div className="flex flex-col">
      <div className="vs-scroll overflow-auto rounded-2xl border bg-card shadow-soft">
        <table className="w-full border-collapse text-sm" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: 40 }} />
            {columns.map((col) => (
              <col key={col.key} style={{ width: widths[col.key] ?? 180 }} />
            ))}
            <col style={{ width: 48 }} />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
            <tr className="border-b">
              <th className="px-2">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={(v) => table.toggleAllRowsSelected(Boolean(v))}
                  aria-label="Select all"
                />
              </th>
              {table.getHeaderGroups()[0]?.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                const colDef = columns.find((c) => c.key === header.column.id);
                return (
                  <th
                    key={header.id}
                    className="group relative border-l py-2 pl-3 pr-1 text-left font-medium"
                  >
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="flex flex-1 items-center gap-1 truncate hover:text-foreground"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <span className="truncate">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                        {sorted === "asc" ? (
                          <ArrowUp className="h-3 w-3 shrink-0" />
                        ) : sorted === "desc" ? (
                          <ArrowDown className="h-3 w-3 shrink-0" />
                        ) : (
                          <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-50" />
                        )}
                      </button>
                      {colDef && <ColumnStatsButton column={colDef} rows={rows} />}
                    </div>
                    <span
                      onMouseDown={(e) => startResize(e, header.column.id)}
                      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none bg-transparent hover:bg-primary/40"
                    />
                  </th>
                );
              })}
              <th className="border-l" />
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, r) => (
              <tr
                key={row.id}
                data-state={row.getIsSelected() ? "selected" : undefined}
                className="border-b last:border-0 data-[state=selected]:bg-accent/40"
              >
                <td className="px-2 text-center align-middle">
                  <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(v) => row.toggleSelected(Boolean(v))}
                    aria-label="Select row"
                  />
                </td>
                {columns.map((col, c) => (
                  <td key={col.key} className="border-l p-0 align-middle">
                    <GridCell
                      column={col}
                      value={row.original.values[col.key] ?? null}
                      meta={row.original.meta[col.key]}
                      isActive={active?.r === r && active?.c === c}
                      isEditing={editing && active?.r === r && active?.c === c}
                      initialChar={
                        editing && active?.r === r && active?.c === c ? initialChar : undefined
                      }
                      onActivate={() => {
                        setActive({ r, c });
                        setEditing(false);
                      }}
                      onStartEdit={(char) => {
                        setActive({ r, c });
                        setInitialChar(char);
                        setEditing(true);
                      }}
                      onCommit={(value) => {
                        setEditing(false);
                        setInitialChar(undefined);
                        onUpdateCell(row.id, col.key, value);
                      }}
                      onCancelEdit={() => {
                        setEditing(false);
                        setInitialChar(undefined);
                      }}
                      onNavigate={moveActive}
                    />
                  </td>
                ))}
                <td className="border-l text-center align-middle">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => onDeleteRow(row.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
            {pageRows.length === 0 && search && (
              <tr>
                <td colSpan={columns.length + 2} className="p-8 text-center text-sm text-muted-foreground">
                  No rows match your search.
                </td>
              </tr>
            )}
            {/* Persistent inline "add row" (hidden while a search filter is active). */}
            {!search && (
              <InlineAddRow columns={columns} onCreate={onCreateRow} />
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {table.getFilteredRowModel().rows.length} row
          {table.getFilteredRowModel().rows.length === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <span className="tabular-nums">
            Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * A persistent bottom row with a blank input per column and a ＋ button.
 * Required-but-empty cells are outlined red until filled. Press Enter in any
 * cell or click ＋ to commit.
 */
function InlineAddRow({
  columns,
  onCreate,
}: {
  columns: ColumnDefinition[];
  onCreate: (values: Record<string, CellValue>) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState<Record<string, CellValue>>({});
  const [saving, setSaving] = useState(false);

  const coercedFor = (col: ColumnDefinition): CellValue => coerceValue(col, draft[col.key] ?? null);
  const hasAnyValue = columns.some((c) => !isEmpty(coercedFor(c)));
  const canAdd = hasAnyValue && !saving;

  async function submit() {
    if (saving || !hasAnyValue) return;
    // Validate required fields only at insert time, with a clear message.
    const missing = columns.filter((c) => c.required && isEmpty(coercedFor(c)));
    if (missing.length > 0) {
      toast.error(
        `Can't add row — fill required field${missing.length > 1 ? "s" : ""}: ${missing
          .map((c) => c.name)
          .join(", ")}`,
      );
      return;
    }
    const values: Record<string, CellValue> = {};
    for (const c of columns) values[c.key] = coercedFor(c);
    try {
      setSaving(true);
      await onCreate(values);
      setDraft({});
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="border-t bg-muted/20">
      <td className="px-2 text-center align-middle">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-primary disabled:text-muted-foreground/50"
          disabled={!canAdd}
          onClick={submit}
          title="Add row"
          aria-label="Add row"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </td>
      {columns.map((col) => (
        <td key={col.key} className="border-l p-0 align-middle">
          <InlineCell
            column={col}
            value={draft[col.key] ?? null}
            onChange={(v) => setDraft((d) => ({ ...d, [col.key]: v }))}
            onEnter={submit}
          />
        </td>
      ))}
      <td className="border-l" />
    </tr>
  );
}

function InlineCell({
  column,
  value,
  onChange,
  onEnter,
}: {
  column: ColumnDefinition;
  value: CellValue;
  onChange: (v: CellValue) => void;
  onEnter: () => void;
}) {
  const [focused, setFocused] = useState(false);

  if (column.type === "BOOLEAN") {
    // Left-aligned with px-3 to match the boolean cells in data rows.
    return (
      <div className="flex h-9 items-center px-3">
        <Checkbox checked={value === true} onCheckedChange={(c) => onChange(Boolean(c))} />
      </div>
    );
  }
  if (column.type === "DROPDOWN") {
    return (
      <Select value={typeof value === "string" ? value : ""} onValueChange={onChange}>
        <SelectTrigger className="h-9 rounded-none border-0 bg-transparent px-3 shadow-none focus:ring-0">
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          {(column.options ?? []).map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  // Date cells render as an empty text field until focused (so an empty add-row
  // cell looks like the others), then switch to a real date picker.
  const isDate = column.type === "DATE";
  const hasValue = value != null && value !== "";
  const inputType = isDate ? (focused || hasValue ? "date" : "text") : "text";

  return (
    <input
      type={inputType}
      inputMode={column.type === "NUMBER" || column.type === "CURRENCY" ? "decimal" : undefined}
      value={value == null ? "" : String(value)}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onEnter();
        }
      }}
      placeholder={column.example ?? ""}
      className="h-9 w-full border-0 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-inset focus:ring-ring"
    />
  );
}
