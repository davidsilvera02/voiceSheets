"use client";

import { useEffect, useRef, useState } from "react";
import { Controller, type Control } from "react-hook-form";
import { cn } from "@/lib/utils";
import type { ColumnDefinition } from "@/lib/columns";
import { apiGet } from "@/lib/api-client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Renders a single form field bound to a React Hook Form control. */
export function FieldInput({
  column,
  control,
  error,
  spreadsheetId,
  autoFocus,
}: {
  column: ColumnDefinition;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>;
  error?: string;
  spreadsheetId?: string;
  autoFocus?: boolean;
}) {
  const canSuggest = Boolean(spreadsheetId) && column.type === "TEXT";

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {column.name}
        {column.required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      <Controller
        control={control}
        name={column.key}
        render={({ field }) => {
          switch (column.type) {
            case "BOOLEAN":
              return (
                <div className="flex h-9 items-center">
                  <Checkbox
                    checked={field.value === true}
                    onCheckedChange={(c) => field.onChange(Boolean(c))}
                  />
                </div>
              );
            case "DROPDOWN":
              return (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(column.options ?? []).map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              );
            case "LONG_TEXT":
              return (
                <Textarea
                  {...field}
                  value={field.value ?? ""}
                  rows={3}
                  placeholder={column.example ?? ""}
                  autoFocus={autoFocus}
                />
              );
            case "DATE":
              return <Input {...field} value={field.value ?? ""} type="date" autoFocus={autoFocus} />;
            case "NUMBER":
            case "CURRENCY":
              return (
                <Input
                  {...field}
                  value={field.value ?? ""}
                  inputMode="decimal"
                  placeholder={column.example ?? (column.type === "CURRENCY" ? "0.00" : "0")}
                  autoFocus={autoFocus}
                />
              );
            default:
              return canSuggest ? (
                <AutocompleteInput
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  spreadsheetId={spreadsheetId!}
                  columnKey={column.key}
                  placeholder={column.example ?? ""}
                  autoFocus={autoFocus}
                />
              ) : (
                <Input
                  {...field}
                  value={field.value ?? ""}
                  placeholder={column.example ?? ""}
                  autoFocus={autoFocus}
                />
              );
          }
        }}
      />
      {column.description && !error && (
        <p className="text-[11px] text-muted-foreground">{column.description}</p>
      )}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

/**
 * A text input with an autocomplete dropdown of previously-entered values.
 * The dropdown is positioned in-flow (absolute within a relative wrapper), so
 * it scrolls together with the surrounding content instead of detaching.
 */
function AutocompleteInput({
  value,
  onChange,
  spreadsheetId,
  columnKey,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  spreadsheetId: string;
  columnKey: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const data = await apiGet<string[]>(
          `/api/spreadsheets/${spreadsheetId}/suggest?column=${encodeURIComponent(columnKey)}&q=${encodeURIComponent(value)}`,
        );
        if (!controller.signal.aborted) {
          setSuggestions(data.filter((s) => s.toLowerCase() !== value.toLowerCase()));
          setActive(-1);
        }
      } catch {
        if (!controller.signal.aborted) setSuggestions([]);
      }
    }, 200);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [value, spreadsheetId, columnKey]);

  const showList = open && suggestions.length > 0;

  function select(s: string) {
    onChange(s);
    setOpen(false);
    setActive(-1);
  }

  return (
    <div className="relative">
      <Input
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!showList) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, suggestions.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            select(suggestions[active]!);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {showList && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-44 overflow-auto rounded-md border bg-popover py-1 shadow-md">
          {suggestions.map((s, i) => (
            <button
              key={s}
              type="button"
              // Prevent input blur from firing before the click.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(s)}
              className={cn(
                "flex w-full items-center px-3 py-1.5 text-left text-sm hover:bg-accent",
                i === active && "bg-accent",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
