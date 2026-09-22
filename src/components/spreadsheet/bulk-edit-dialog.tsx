"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { CellValue, ColumnDefinition } from "@/lib/columns";
import { coerceValue } from "@/lib/columns";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBulkUpdateRows } from "@/hooks/use-rows";

export function BulkEditDialog({
  open,
  onOpenChange,
  spreadsheetId,
  columns,
  rowIds,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  spreadsheetId: string;
  columns: ColumnDefinition[];
  rowIds: string[];
  onDone: () => void;
}) {
  const bulk = useBulkUpdateRows(spreadsheetId);
  const [columnKey, setColumnKey] = useState(columns[0]?.key ?? "");
  const [raw, setRaw] = useState<string>("");
  const [boolVal, setBoolVal] = useState(false);

  useEffect(() => {
    if (open) {
      setColumnKey(columns[0]?.key ?? "");
      setRaw("");
      setBoolVal(false);
    }
  }, [open, columns]);

  const column = columns.find((c) => c.key === columnKey);

  async function apply() {
    if (!column) return;
    const value: CellValue = column.type === "BOOLEAN" ? boolVal : coerceValue(column, raw);
    try {
      await bulk.mutateAsync({ rowIds, values: { [columnKey]: value } });
      toast.success(`Se actualizaron ${rowIds.length} filas`);
      onOpenChange(false);
      onDone();
    } catch {
      toast.error("Error en la edición masiva");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edición masiva de {rowIds.length} filas</DialogTitle>
          <DialogDescription>Establece una columna con el mismo valor en todas las filas seleccionadas.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Columna</Label>
            <Select value={columnKey} onValueChange={setColumnKey}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {columns.map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Nuevo valor</Label>
            {column?.type === "BOOLEAN" ? (
              <div className="flex h-9 items-center gap-2">
                <Checkbox checked={boolVal} onCheckedChange={(v) => setBoolVal(Boolean(v))} />
                <span className="text-sm text-muted-foreground">{boolVal ? "Marcado" : "Sin marcar"}</span>
              </div>
            ) : column?.type === "DROPDOWN" ? (
              <Select value={raw} onValueChange={setRaw}>
                <SelectTrigger>
                  <SelectValue placeholder="Elige…" />
                </SelectTrigger>
                <SelectContent>
                  {(column.options ?? []).map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                type={column?.type === "DATE" ? "date" : "text"}
                placeholder="Deja en blanco para borrar"
              />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={apply} disabled={bulk.isPending}>
            {bulk.isPending ? "Aplicando…" : "Aplicar a las filas"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
