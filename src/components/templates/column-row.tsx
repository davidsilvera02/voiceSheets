"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronRight, GripVertical, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { COLUMN_TYPES, COLUMN_TYPE_META, type ColumnType } from "@/lib/columns";

/** A representative example placeholder for each column type. */
function examplePlaceholder(type: ColumnType, options: string[]): string {
  switch (type) {
    case "NUMBER":
      return "e.g. 30";
    case "CURRENCY":
      return "e.g. 4.50";
    case "DATE":
      return "e.g. 2026-08-01";
    case "BOOLEAN":
      return "e.g. true";
    case "DROPDOWN":
      return options[0] ? `e.g. ${options[0]}` : "e.g. High";
    case "LONG_TEXT":
      return "e.g. Ships within two weeks";
    default:
      return "e.g. Acme Corp";
  }
}
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
}: {
  column: EditableColumn;
  onChange: (next: EditableColumn) => void;
  onRemove: () => void;
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
      <div className="flex items-center gap-2 p-2">
        <button
          type="button"
          className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-accent active:cursor-grabbing"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <Input
          value={column.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Column name"
          className="h-8 flex-1"
        />
        <Select value={column.type} onValueChange={(v) => set("type", v as ColumnType)}>
          <SelectTrigger className="h-8 w-40">
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
            aria-label="Required"
          />
          <span className="hidden text-xs text-muted-foreground sm:inline">Req</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {expanded && (
        <div className="grid gap-4 border-t p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Input
              value={column.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="What this column holds"
              className="h-8"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Example value</Label>
            <Input
              value={column.example}
              onChange={(e) => set("example", e.target.value)}
              placeholder={examplePlaceholder(column.type, column.options)}
              className="h-8"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Default value</Label>
            <Input
              value={column.defaultValue}
              onChange={(e) => set("defaultValue", e.target.value)}
              placeholder="Prefilled for new rows"
              className="h-8"
            />
          </div>
          {(column.type === "CURRENCY") && (
            <div className="space-y-1.5">
              <Label className="text-xs">Currency code</Label>
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
              <Label className="text-xs">Options</Label>
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
                      placeholder={`Option ${i + 1}`}
                      className="h-8 flex-1"
                      autoFocus={i === column.options.length - 1 && opt === ""}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => set("options", column.options.filter((_, j) => j !== i))}
                      aria-label="Remove option"
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
                  <Plus className="h-4 w-4" /> Add option
                </Button>
                {column.options.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Add at least one choice for this dropdown.
                  </p>
                )}
              </div>
            </div>
          )}
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">AI hint</Label>
            <Textarea
              value={column.aiHint}
              onChange={(e) => set("aiHint", e.target.value)}
              placeholder="Explain this field to the AI, e.g. 'The vendor's legal company name, not a person.'"
              rows={2}
            />
            <p className="text-[11px] text-muted-foreground">
              Used when generating rows from voice/dictation to help the AI pick the right value.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
