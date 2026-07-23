"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { FileUp, Upload } from "lucide-react";
import { toast } from "sonner";
import type { CellValue, ColumnDefinition } from "@/lib/columns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useImportRows } from "@/hooks/use-rows";

const SKIP = "__skip__";

type SourceRow = Record<string, string>;

export function ImportDialog({
  open,
  onOpenChange,
  spreadsheetId,
  columns,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  spreadsheetId: string;
  columns: ColumnDefinition[];
}) {
  const importRows = useImportRows(spreadsheetId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<SourceRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  function reset() {
    setFileName("");
    setHeaders([]);
    setRows([]);
    setMapping({});
  }

  function autoMap(sourceHeaders: string[]) {
    const next: Record<string, string> = {};
    for (const col of columns) {
      const match = sourceHeaders.find(
        (h) =>
          h.toLowerCase().trim() === col.name.toLowerCase() ||
          h.toLowerCase().trim() === col.key,
      );
      next[col.key] = match ?? SKIP;
    }
    setMapping(next);
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    try {
      if (file.name.toLowerCase().endsWith(".csv")) {
        const text = await file.text();
        const parsed = Papa.parse<SourceRow>(text, { header: true, skipEmptyLines: true });
        const hdrs = parsed.meta.fields ?? [];
        setHeaders(hdrs);
        setRows(parsed.data);
        autoMap(hdrs);
      } else {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]!];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet!, { defval: "" });
        const hdrs = json.length > 0 ? Object.keys(json[0]!) : [];
        setHeaders(hdrs);
        setRows(json.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v ?? "")]))));
        autoMap(hdrs);
      }
    } catch {
      toast.error("Could not read that file. Please use a valid CSV or Excel file.");
    }
  }

  async function runImport() {
    if (rows.length === 0) {
      toast.error("This file has no data rows to import.");
      return;
    }
    const mapped: Record<string, CellValue>[] = rows.map((row) => {
      const record: Record<string, CellValue> = {};
      for (const col of columns) {
        const header = mapping[col.key];
        record[col.key] = header && header !== SKIP ? (row[header] ?? null) : null;
      }
      return record;
    });
    try {
      const res = await importRows.mutateAsync(mapped);
      toast.success(
        `Imported ${res.imported} rows${res.failed ? ` · ${res.failed} skipped` : ""}`,
      );
      reset();
      onOpenChange(false);
    } catch {
      toast.error("Import failed");
    }
  }

  const mappedCount = Object.values(mapping).filter((v) => v && v !== SKIP).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import from CSV / Excel</DialogTitle>
          <DialogDescription>
            Upload a file and map its columns to this spreadsheet&apos;s fields.
          </DialogDescription>
        </DialogHeader>

        {headers.length === 0 ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center transition-colors hover:border-primary/50 hover:bg-accent/40"
          >
            <FileUp className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-medium">Choose a .csv or .xlsx file</span>
            <span className="text-xs text-muted-foreground">
              The first row should contain column headers.
            </span>
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{fileName}</span> · {rows.length} rows ·{" "}
              {mappedCount}/{columns.length} columns mapped
            </p>
            <div className="max-h-[45vh] space-y-2 overflow-y-auto rounded-lg border p-3">
              {columns.map((col) => (
                <div key={col.key} className="grid grid-cols-2 items-center gap-3">
                  <Label className="text-xs">
                    {col.name}
                    {col.required && <span className="ml-0.5 text-destructive">*</span>}
                  </Label>
                  <Select
                    value={mapping[col.key] ?? SKIP}
                    onValueChange={(v) => setMapping((m) => ({ ...m, [col.key]: v }))}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SKIP}>— Skip —</SelectItem>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />

        <DialogFooter>
          {headers.length > 0 && (
            <Button variant="outline" onClick={reset}>
              Choose another file
            </Button>
          )}
          <Button
            onClick={runImport}
            disabled={headers.length === 0 || mappedCount === 0 || importRows.isPending}
          >
            <Upload className="h-4 w-4" />
            {importRows.isPending ? "Importing…" : `Import ${rows.length} rows`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
