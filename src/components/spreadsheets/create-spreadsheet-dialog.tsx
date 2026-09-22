"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { FileUp } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTemplates } from "@/hooks/use-templates";
import { useCreateSpreadsheet } from "@/hooks/use-spreadsheets";
import { apiPost, ApiClientError } from "@/lib/api-client";
import { COLUMN_TYPES, COLUMN_TYPE_META, type ColumnType } from "@/lib/columns";
import { inferColumns, type InferredColumn } from "@/lib/infer-columns";
import type { SpreadsheetDTO, TemplateDTO } from "@/lib/types";

type SourceRow = Record<string, string>;

export function CreateSpreadsheetDialog({
  open,
  onOpenChange,
  templateId: fixedTemplateId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId?: string;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const templates = useTemplates({ status: "ACTIVE" });
  const create = useCreateSpreadsheet();

  const [mode, setMode] = useState<"template" | "import">("template");

  // --- Template mode ---
  const [templateId, setTemplateId] = useState(fixedTemplateId ?? "");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // --- Import mode ---
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [sourceHeaders, setSourceHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<SourceRow[]>([]);
  const [inferred, setInferred] = useState<InferredColumn[]>([]);
  const [importName, setImportName] = useState("");
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (fixedTemplateId) setTemplateId(fixedTemplateId);
  }, [fixedTemplateId]);

  useEffect(() => {
    if (!templateId && templates.data?.data.length) {
      setTemplateId(templates.data.data[0]!.id);
    }
  }, [templates.data, templateId]);

  function resetImport() {
    setFileName("");
    setSourceHeaders([]);
    setRows([]);
    setInferred([]);
    setImportName("");
  }

  function close(o: boolean) {
    if (!o) {
      resetImport();
      setName("");
      setDescription("");
    }
    onOpenChange(o);
  }

  // --- Template create ---
  async function handleCreate() {
    if (!templateId) return toast.error("Elige una plantilla primero");
    if (!name.trim()) return toast.error("Ponle un nombre a tu hoja de cálculo");
    try {
      const sheet = await create.mutateAsync({ templateId, name: name.trim(), description });
      toast.success("Hoja de cálculo creada");
      close(false);
      router.push(`/spreadsheets/${sheet.id}`);
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "No se pudo crear la hoja de cálculo");
    }
  }

  // --- Import parse ---
  async function handleFile(file: File) {
    try {
      let headers: string[] = [];
      let parsedRows: SourceRow[] = [];
      if (file.name.toLowerCase().endsWith(".csv")) {
        const text = await file.text();
        const parsed = Papa.parse<SourceRow>(text, { header: true, skipEmptyLines: true });
        headers = parsed.meta.fields ?? [];
        parsedRows = parsed.data;
      } else {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]!]!;
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        if (json.length > 0) {
          headers = Object.keys(json[0]!);
          parsedRows = json.map((r) =>
            Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v ?? "")])),
          );
        } else {
          // Headers-only sheet: sheet_to_json yields no rows and thus no keys,
          // so read the first row directly to recover the column headers.
          const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
          headers = (aoa[0] ?? []).map((h) => String(h ?? ""));
          parsedRows = [];
        }
      }
      const kept = headers.filter((h) => h && h.trim());
      if (kept.length === 0) {
        toast.error("No se encontraron columnas. Asegúrate de que la primera fila tenga encabezados.");
        return;
      }
      setFileName(file.name);
      setSourceHeaders(kept);
      setRows(parsedRows);
      setInferred(inferColumns(headers, parsedRows));
      setImportName(file.name.replace(/\.[^.]+$/, ""));
    } catch {
      toast.error("No se pudo leer ese archivo. Usa un archivo CSV o Excel válido.");
    }
  }

  function setColumnType(index: number, type: ColumnType) {
    setInferred((cols) => cols.map((c, i) => (i === index ? { ...c, type } : c)));
  }

  // --- Import submit: create template → spreadsheet → import rows ---
  async function handleImport() {
    if (!importName.trim()) return toast.error("Ponle un nombre a tu hoja de cálculo");
    if (inferred.length === 0) return toast.error("Sube un archivo primero");
    setImporting(true);
    try {
      // Build template columns; derive dropdown options from data when needed.
      const columns = inferred.map((c, i) => {
        let options = c.options;
        if (c.type === "DROPDOWN" && (!options || options.length === 0)) {
          const seen = new Map<string, string>();
          for (const row of rows) {
            const v = (row[sourceHeaders[i]!] ?? "").trim();
            if (v && !seen.has(v.toLowerCase())) seen.set(v.toLowerCase(), v);
            if (seen.size >= 50) break;
          }
          options = Array.from(seen.values());
        }
        return {
          key: c.key,
          name: c.name,
          type: c.type,
          options: c.type === "DROPDOWN" ? options : undefined,
          config: c.type === "CURRENCY" ? { currency: c.currency ?? "USD" } : undefined,
        };
      });

      const template = await apiPost<TemplateDTO>("/api/templates", {
        name: `${importName.trim()} template`,
        description: `Auto-generated from ${fileName}`,
        columns,
      });
      const sheet = await apiPost<SpreadsheetDTO>("/api/spreadsheets", {
        templateId: template.id,
        name: importName.trim(),
        description: `Imported from ${fileName}`,
      });

      const records = rows.map((row) => {
        const rec: Record<string, string> = {};
        inferred.forEach((c, i) => {
          rec[c.key] = row[sourceHeaders[i]!] ?? "";
        });
        return rec;
      });

      // A headers-only file just sets up the columns — skip the (rows ≥ 1) import.
      if (records.length > 0) {
        const result = await apiPost<{ imported: number; failed: number }>(
          `/api/spreadsheets/${sheet.id}/import`,
          { rows: records, source: "IMPORT" },
        );
        toast.success(
          `Se importaron ${result.imported} filas a una nueva hoja de cálculo${result.failed ? ` · ${result.failed} omitidas` : ""}`,
        );
      } else {
        toast.success("Se creó una hoja de cálculo a partir de las columnas de tu archivo");
      }

      qc.invalidateQueries({ queryKey: ["spreadsheets"] });
      qc.invalidateQueries({ queryKey: ["templates"] });
      close(false);
      router.push(`/spreadsheets/${sheet.id}`);
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "Error al importar");
    } finally {
      setImporting(false);
    }
  }

  const noTemplates = templates.data && templates.data.data.length === 0;

  const templateForm = (
    <div className="space-y-4">
      {noTemplates && !fixedTemplateId ? (
        <p className="text-sm text-muted-foreground">
          Aún no tienes plantillas — cambia a <span className="font-medium">Importar archivo</span> para
          crear una a partir de una hoja de cálculo, o{" "}
          <a className="text-primary underline" href="/templates/new">
            crea una
          </a>
          .
        </p>
      ) : (
        <>
          {!fixedTemplateId && (
            <div className="space-y-1.5">
              <Label>Plantilla</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Elige una plantilla" />
                </SelectTrigger>
                <SelectContent>
                  {templates.data?.data.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="sheet-name">Nombre</Label>
            <Input
              id="sheet-name"
              placeholder="p. ej. Suministros de oficina — junio"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sheet-desc">Descripción (opcional)</Label>
            <Textarea
              id="sheet-desc"
              placeholder="¿Para qué es esta hoja de cálculo?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
        </>
      )}
    </div>
  );

  const importForm =
    inferred.length === 0 ? (
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/40"
      >
        <FileUp className="h-8 w-8 text-muted-foreground" />
        <span className="text-sm font-medium">Elige un archivo .csv o .xlsx</span>
        <span className="text-xs text-muted-foreground">
          Detectaremos las columnas y crearemos una plantilla automáticamente.
        </span>
      </button>
    ) : (
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="import-name">Nombre de la hoja de cálculo</Label>
          <Input
            id="import-name"
            value={importName}
            onChange={(e) => setImportName(e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <Label className="text-xs">
              {inferred.length} columnas · {rows.length} filas
            </Label>
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => inputRef.current?.click()}
            >
              Cambiar archivo
            </button>
          </div>
          <div className="max-h-[40vh] space-y-1.5 overflow-y-auto rounded-lg border p-2">
            {inferred.map((col, i) => (
              <div key={col.key} className="grid grid-cols-2 items-center gap-2">
                <span className="truncate pl-1 text-sm">{col.name}</span>
                <Select value={col.type} onValueChange={(v) => setColumnType(i, v as ColumnType)}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLUMN_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {COLUMN_TYPE_META[t].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>
      </div>
    );

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva hoja de cálculo</DialogTitle>
          <DialogDescription>
            Empieza desde una plantilla, o importa un archivo CSV/Excel para crear una automáticamente.
          </DialogDescription>
        </DialogHeader>

        {fixedTemplateId ? (
          templateForm
        ) : (
          <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="template">Desde plantilla</TabsTrigger>
              <TabsTrigger value="import">Importar archivo</TabsTrigger>
            </TabsList>
            {/* A shared min-height keeps the dialog the same size on both tabs,
                so switching doesn't resize and re-center it under the cursor. */}
            <TabsContent value="template" className="min-h-[16.5rem] pt-1">
              {templateForm}
            </TabsContent>
            <TabsContent value="import" className="min-h-[16.5rem] pt-1">
              {importForm}
            </TabsContent>
          </Tabs>
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
          <Button variant="outline" onClick={() => close(false)}>
            Cancelar
          </Button>
          {!fixedTemplateId && mode === "import" ? (
            <Button onClick={handleImport} disabled={importing || inferred.length === 0}>
              {importing
                ? "Importando…"
                : rows.length
                  ? `Crear e importar ${rows.length} filas`
                  : "Crear hoja de cálculo"}
            </Button>
          ) : (
            <Button onClick={handleCreate} disabled={create.isPending || noTemplates}>
              {create.isPending ? "Creando…" : "Crear hoja de cálculo"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
