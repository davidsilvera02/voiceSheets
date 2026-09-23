"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronRight, GripVertical, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { COLUMN_TYPES, COLUMN_TYPE_META, type ColumnType } from "@/lib/columns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface EditableColumn {
  id: string;
  key?: string;
  name: string;
  type: ColumnType;
  required: boolean;
  defaultValue: string;
  description: string;
  example: string;
  aiHint: string;
  options: string[];
  currency: string;
}

export function ColumnRow({
  column,
  onChange,
  onRemove,
  locked = false,
}: {
  column: EditableColumn;
  onChange: (next: EditableColumn) => void;
  onRemove: () => void;
  /**
   * Structure lock: when the template already has spreadsheets, the column's
   * name, type, required flag, and order can't change and it can't be removed —
   * but descriptions, options, and AI hints stay editable.
   */
  locked?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };

  function set<K extends keyof EditableColumn>(field: K, value: EditableColumn[K]) {
    onChange({ ...column, [field]: value });
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-lg border bg-card",
        isDragging && "opacity-80 shadow-lg ring-1 ring-primary/40",
      )}
    >
      {/* Stacks on mobile (name on its own row) so the name field isn't crushed
          by the type/required controls on a narrow screen. */}
      <div className="flex flex-col gap-2 p-2 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2">
          <button
            type="button"
            disabled={locked}
            className={cn(
              "touch-none rounded p-1 text-muted-foreground",
              locked
                ? "cursor-not-allowed opacity-40"
                : "cursor-grab hover:bg-accent active:cursor-grabbing",
            )}
            {...(locked ? {} : attributes)}
            {...(locked ? {} : listeners)}
            aria-label={locked ? "El orden está bloqueado" : "Arrastra para reordenar"}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <Input
            value={column.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Nombre de la columna"
            className="h-9 flex-1"
            disabled={locked}
            title={locked ? "El nombre está bloqueado mientras existan hojas de cálculo" : undefined}
          />
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={column.type}
            onValueChange={(v) => set("type", v as ColumnType)}
            disabled={locked}
          >
            <SelectTrigger
              className="h-9 flex-1 sm:w-40 sm:flex-none"
              title={locked ? "El tipo está bloqueado mientras existan hojas de cálculo" : undefined}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COLUMN_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {COLUMN_TYPE_META[type].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1.5 px-1">
            <Switch
              checked={column.required}
              onCheckedChange={(v) => set("required", v)}
              disabled={locked}
              aria-label="Obligatorio"
            />
            <span className="text-xs text-muted-foreground">Oblig</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
          {!locked && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={onRemove}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="grid gap-4 border-t p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Descripción</Label>
            <Input
              value={column.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Qué contiene esta columna"
              className="h-8"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Valor predeterminado</Label>
            <Input
              value={column.defaultValue}
              onChange={(e) => set("defaultValue", e.target.value)}
              placeholder="Se rellena en las filas nuevas"
              className="h-8"
            />
          </div>
          {(column.type === "CURRENCY") && (
            <div className="space-y-1.5">
              <Label className="text-xs">Código de moneda</Label>
              <Input
                value={column.currency}
                onChange={(e) => set("currency", e.target.value.toUpperCase().slice(0, 3))}
                placeholder="USD"
                className="h-8"
              />
            </div>
          )}
          {column.type === "DROPDOWN" && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Opciones</Label>
              <div className="space-y-1.5">
                {column.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-4 text-center text-xs text-muted-foreground">{i + 1}</span>
                    <Input
                      value={opt}
                      onChange={(e) => {
                        const next = [...column.options];
                        next[i] = e.target.value;
                        set("options", next);
                      }}
                      placeholder={`Opción ${i + 1}`}
                      className="h-8 flex-1"
                      autoFocus={i === column.options.length - 1 && opt === ""}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => set("options", column.options.filter((_, j) => j !== i))}
                      aria-label="Eliminar opción"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => set("options", [...column.options, ""])}
                >
                  <Plus className="h-4 w-4" /> Añadir opción
                </Button>
                {column.options.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Añade al menos una opción para esta lista desplegable.
                  </p>
                )}
              </div>
            </div>
          )}
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Sugerencia para la IA</Label>
            <Textarea
              value={column.aiHint}
              onChange={(e) => set("aiHint", e.target.value)}
              placeholder="Explica este campo a la IA."
              rows={2}
            />
          </div>
        </div>
      )}
    </div>
  );
}
