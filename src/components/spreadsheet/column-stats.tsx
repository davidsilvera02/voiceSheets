"use client";

import { BarChart2 } from "lucide-react";
import {
  type ColumnDefinition,
  formatCellValue,
  parseDate,
  parseNumeric,
} from "@/lib/columns";
import type { RowDTO } from "@/lib/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** A compact per-column statistics popover shown in the grid header. */
export function ColumnStatsButton({
  column,
  rows,
}: {
  column: ColumnDefinition;
  rows: RowDTO[];
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Column statistics"
          onClick={(e) => e.stopPropagation()}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus:opacity-100 group-hover:opacity-70"
        >
          <BarChart2 className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <StatsContent column={column} rows={rows} />
      </PopoverContent>
    </Popover>
  );
}

/** A single row: label, a horizontal bar, and count + percentage. */
function BarRow({
  label,
  count,
  pct,
  fill,
}: {
  label: string;
  count: number;
  pct: number; // 0..1 of total (shown as %)
  fill: number; // 0..1 bar width relative to the largest value
}) {
  return (
    <div className="py-1">
      <div className="mb-1 flex items-center justify-between gap-2 text-sm">
        <span className="truncate text-muted-foreground">{label}</span>
        <span className="shrink-0 tabular-nums">
          <span className="font-medium">{count}</span>{" "}
          <span className="text-xs text-muted-foreground">({Math.round(pct * 100)}%)</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.max(2, fill * 100)}%` }}
        />
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function StatsContent({ column, rows }: { column: ColumnDefinition; rows: RowDTO[] }) {
  const raw = rows.map((r) => r.values[column.key] ?? null);
  const filled = raw.filter((v) => v !== null && v !== "");
  const fmt = (n: number) => formatCellValue(column, n);
  const fillPct = rows.length ? Math.round((filled.length / rows.length) * 100) : 0;

  const header = (
    <div className="mb-2 flex items-center justify-between border-b pb-2">
      <span className="text-sm font-semibold">{column.name}</span>
      <span className="text-xs text-muted-foreground">
        {filled.length}/{rows.length} filled ({fillPct}%)
      </span>
    </div>
  );

  if (rows.length === 0) {
    return (
      <div>
        {header}
        <p className="text-sm text-muted-foreground">No rows yet.</p>
      </div>
    );
  }

  if (column.type === "NUMBER" || column.type === "CURRENCY") {
    const nums = filled.map((v) => parseNumeric(v)).filter((n): n is number => n !== null);
    if (nums.length === 0)
      return <div>{header}<p className="text-sm text-muted-foreground">No numeric values.</p></div>;
    const sum = nums.reduce((a, b) => a + b, 0);
    return (
      <div>
        {header}
        <StatRow label="Sum" value={fmt(sum)} />
        <StatRow label="Average" value={fmt(sum / nums.length)} />
        <StatRow label="Min" value={fmt(Math.min(...nums))} />
        <StatRow label="Max" value={fmt(Math.max(...nums))} />
        <StatRow label="Count" value={String(nums.length)} />
      </div>
    );
  }

  if (column.type === "BOOLEAN") {
    const t = raw.filter((v) => v === true).length;
    const f = raw.filter((v) => v === false).length;
    const total = t + f;
    const max = Math.max(t, f, 1);
    return (
      <div>
        {header}
        <BarRow label="Checked" count={t} pct={total ? t / total : 0} fill={t / max} />
        <BarRow label="Unchecked" count={f} pct={total ? f / total : 0} fill={f / max} />
      </div>
    );
  }

  if (column.type === "DATE") {
    const dates = filled.map((v) => parseDate(v)).filter((d): d is string => d !== null).sort();
    if (dates.length === 0)
      return <div>{header}<p className="text-sm text-muted-foreground">No dates.</p></div>;
    return (
      <div>
        {header}
        <StatRow label="Earliest" value={dates[0]!} />
        <StatRow label="Latest" value={dates[dates.length - 1]!} />
        <StatRow label="Count" value={String(dates.length)} />
      </div>
    );
  }

  // TEXT / LONG_TEXT / DROPDOWN → distribution of top values
  const counts = new Map<string, number>();
  for (const v of filled) {
    const key = String(v);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 5);
  const maxCount = top[0]?.[1] ?? 1;
  const total = filled.length;
  const remaining = sorted.length - top.length;

  return (
    <div>
      {header}
      <p className="mb-1 text-xs text-muted-foreground">
        {counts.size} distinct value{counts.size === 1 ? "" : "s"}
      </p>
      {top.map(([value, count]) => (
        <BarRow
          key={value}
          label={value.length > 24 ? `${value.slice(0, 23)}…` : value}
          count={count}
          pct={total ? count / total : 0}
          fill={count / maxCount}
        />
      ))}
      {top.length === 0 && <p className="text-sm text-muted-foreground">No values.</p>}
      {remaining > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">+{remaining} more</p>
      )}
    </div>
  );
}
