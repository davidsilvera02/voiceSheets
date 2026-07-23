"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  type CellValue,
  type ColumnDefinition,
  coerceValue,
  formatCellValue,
} from "@/lib/columns";
import { CONFIDENCE_META, confidenceLevel } from "@/lib/confidence";
import type { CellMeta } from "@/lib/types";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type NavDirection = "up" | "down" | "left" | "right" | "tab";

interface GridCellProps {
  column: ColumnDefinition;
  value: CellValue;
  meta?: CellMeta;
  isActive: boolean;
  isEditing: boolean;
  initialChar?: string;
  onActivate: () => void;
  onStartEdit: (initialChar?: string) => void;
  onCommit: (value: CellValue) => void;
  onCancelEdit: () => void;
  onNavigate: (direction: NavDirection) => void;
}

export function GridCell(props: GridCellProps) {
  const { column, value, meta, isActive, isEditing } = props;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const level = meta?.aiGenerated ? confidenceLevel(meta.confidence) : null;

  useEffect(() => {
    if (isActive && !isEditing) wrapperRef.current?.focus();
  }, [isActive, isEditing]);

  // BOOLEAN and DROPDOWN edit inline without a separate edit mode.
  if (column.type === "BOOLEAN") {
    return (
      <div
        ref={wrapperRef}
        tabIndex={0}
        onFocus={props.onActivate}
        onKeyDown={(e) => handleWrapperKey(e, props, true)}
        className={cellWrapperClass(isActive, level)}
      >
        <Checkbox
          checked={value === true}
          onCheckedChange={(c) => props.onCommit(Boolean(c))}
          aria-label={column.name}
        />
      </div>
    );
  }

  if (column.type === "DROPDOWN") {
    return (
      <div
        ref={wrapperRef}
        tabIndex={0}
        onFocus={props.onActivate}
        onKeyDown={(e) => handleWrapperKey(e, props, false)}
        className={cn(cellWrapperClass(isActive, level), "p-0")}
      >
        <Select
          value={typeof value === "string" ? value : ""}
          onValueChange={(v) => props.onCommit(v)}
        >
          <SelectTrigger className="h-full w-full rounded-none border-0 bg-transparent px-3 shadow-none focus:ring-0">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {(column.options ?? []).map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (isEditing) {
    return (
      <CellInput
        column={column}
        value={value}
        initialChar={props.initialChar}
        onCommit={props.onCommit}
        onCancel={props.onCancelEdit}
        onNavigate={props.onNavigate}
      />
    );
  }

  return (
    <div
      ref={wrapperRef}
      tabIndex={0}
      onFocus={props.onActivate}
      onDoubleClick={() => props.onStartEdit()}
      onKeyDown={(e) => handleWrapperKey(e, props, false)}
      className={cn(cellWrapperClass(isActive, level), "cursor-text")}
      title={level ? CONFIDENCE_META[level].label : undefined}
    >
      <span className="block truncate">{formatCellValue(column, value)}</span>
      {level && (
        <span
          className={cn("ml-auto h-1.5 w-1.5 shrink-0 rounded-full", CONFIDENCE_META[level].dot)}
        />
      )}
    </div>
  );
}

function cellWrapperClass(isActive: boolean, level: ReturnType<typeof confidenceLevel>) {
  return cn(
    "flex h-9 w-full items-center gap-1 border-l-2 border-l-transparent px-3 text-sm outline-none",
    isActive && "ring-1 ring-inset ring-ring bg-accent/40",
    level && CONFIDENCE_META[level].border,
  );
}

function handleWrapperKey(
  e: React.KeyboardEvent,
  props: GridCellProps,
  isBoolean: boolean,
) {
  switch (e.key) {
    case "ArrowUp":
      e.preventDefault();
      props.onNavigate("up");
      break;
    case "ArrowDown":
      e.preventDefault();
      props.onNavigate("down");
      break;
    case "ArrowLeft":
      e.preventDefault();
      props.onNavigate("left");
      break;
    case "ArrowRight":
      e.preventDefault();
      props.onNavigate("right");
      break;
    case "Tab":
      e.preventDefault();
      props.onNavigate("tab");
      break;
    case "Enter":
      e.preventDefault();
      if (isBoolean) props.onCommit(!(props.value === true));
      else props.onStartEdit();
      break;
    case "Backspace":
    case "Delete":
      if (!isBoolean) {
        e.preventDefault();
        props.onCommit(null);
      }
      break;
    default:
      if (!isBoolean && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        props.onStartEdit(e.key);
      }
  }
}

function CellInput({
  column,
  value,
  initialChar,
  onCommit,
  onCancel,
  onNavigate,
}: {
  column: ColumnDefinition;
  value: CellValue;
  initialChar?: string;
  onCommit: (value: CellValue) => void;
  onCancel: () => void;
  onNavigate: (direction: NavDirection) => void;
}) {
  const [draft, setDraft] = useState<string>(() => {
    if (initialChar) return initialChar;
    if (value == null) return "";
    return column.type === "DATE" ? String(value) : String(value);
  });
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    // Place the cursor at the end instead of selecting all, so a double-click
    // positions the caret; a further (triple) click selects the whole value.
    // Only text inputs support setSelectionRange — date/number inputs throw.
    if (el instanceof HTMLInputElement && el.type === "text" && !initialChar) {
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function commit(nav?: NavDirection) {
    onCommit(coerceValue(column, draft));
    if (nav) onNavigate(nav);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && column.type !== "LONG_TEXT") {
      e.preventDefault();
      commit("down");
    } else if (e.key === "Enter" && e.metaKey) {
      e.preventDefault();
      commit("down");
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    } else if (e.key === "Tab") {
      e.preventDefault();
      commit("tab");
    }
  }

  const common = {
    ref: ref as never,
    value: draft,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft(e.target.value),
    onBlur: () => commit(),
    onKeyDown,
    className:
      "h-9 w-full rounded-none border-0 bg-background px-3 text-sm outline-none ring-1 ring-inset ring-ring",
  };

  if (column.type === "LONG_TEXT") {
    return <textarea {...common} rows={2} className={cn(common.className, "h-16 py-1.5")} />;
  }
  return (
    <input
      {...common}
      type={column.type === "DATE" ? "date" : column.type === "NUMBER" || column.type === "CURRENCY" ? "text" : "text"}
      inputMode={column.type === "NUMBER" || column.type === "CURRENCY" ? "decimal" : undefined}
    />
  );
}
