"use client";

import {
  Columns3,
  Copy,
  Download,
  History,
  Mic,
  MoreHorizontal,
  Pencil,
  Plus,
  Redo2,
  Search,
  Trash2,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import type { ColumnDefinition } from "@/lib/columns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface ToolbarProps {
  columns: ColumnDefinition[];
  search: string;
  onSearchChange: (v: string) => void;
  onToggleColumn: (key: string, hidden: boolean) => void;
  onAddRow: () => void;
  onVoiceEntry?: () => void;
  onImport?: () => void;
  onExport: (format: "csv" | "xlsx") => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onOpenHistory: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  selectedCount: number;
  onBulkEdit: () => void;
  onBulkDelete: () => void;
  onClearSelection: () => void;
}

export function SpreadsheetToolbar(props: ToolbarProps) {
  if (props.selectedCount > 0) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-accent/40 p-2">
        <span className="px-2 text-sm font-medium">{props.selectedCount} seleccionadas</span>
        <Button variant="outline" size="sm" onClick={props.onBulkEdit}>
          <Pencil className="h-4 w-4" /> Editar en lote
        </Button>
        <Button variant="outline" size="sm" onClick={props.onBulkDelete}>
          <Trash2 className="h-4 w-4" /> Eliminar
        </Button>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={props.onClearSelection}>
          <X className="h-4 w-4" /> Limpiar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={props.onAddRow}>
        <Plus className="h-4 w-4" /> Añadir fila
      </Button>
      {props.onVoiceEntry && (
        <Button size="sm" variant="secondary" onClick={props.onVoiceEntry}>
          <Mic className="h-4 w-4" /> Entrada por voz
        </Button>
      )}

      <div className="relative ml-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={props.search}
          onChange={(e) => props.onSearchChange(e.target.value)}
          placeholder="Buscar filas…"
          className="h-8 w-48 pl-8"
        />
      </div>

      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={props.onUndo}
          disabled={!props.canUndo}
          title="Deshacer (⌘Z)"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={props.onRedo}
          disabled={!props.canRedo}
          title="Rehacer (⌘⇧Z)"
        >
          <Redo2 className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Columnas">
              <Columns3 className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80 overflow-auto">
            <DropdownMenuLabel>Mostrar u ocultar columnas</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {props.columns.map((c) => (
              <DropdownMenuCheckboxItem
                key={c.key}
                checked={!c.hidden}
                onCheckedChange={(checked) => props.onToggleColumn(c.key, !checked)}
                onSelect={(e) => e.preventDefault()}
              >
                {c.name}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Exportar">
              <Download className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => props.onExport("xlsx")}>
              <Download className="h-4 w-4" /> Exportar como Excel (.xlsx)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => props.onExport("csv")}>
              <Download className="h-4 w-4" /> Exportar como CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={props.onRename}>
              <Pencil className="h-4 w-4" /> Cambiar nombre
            </DropdownMenuItem>
            <DropdownMenuItem onClick={props.onDuplicate}>
              <Copy className="h-4 w-4" /> Duplicar
            </DropdownMenuItem>
            {props.onImport && (
              <DropdownMenuItem onClick={props.onImport}>
                <Upload className="h-4 w-4" /> Importar CSV / Excel
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={props.onOpenHistory}>
              <History className="h-4 w-4" /> Historial de versiones
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={props.onDelete}
            >
              <Trash2 className="h-4 w-4" /> Eliminar hoja de cálculo
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
