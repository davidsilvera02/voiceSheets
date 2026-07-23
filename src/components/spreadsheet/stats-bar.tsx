"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { ColumnStat } from "@/lib/types";
import type { ColumnDefinition } from "@/lib/columns";
import { formatCellValue } from "@/lib/columns";

export function StatsBar({
  spreadsheetId,
  columns,
}: {
  spreadsheetId: string;
  columns: ColumnDefinition[];
}) {
  const { data } = useQuery({
    queryKey: queryKeys.stats(spreadsheetId),
    queryFn: () => apiGet<ColumnStat[]>(`/api/spreadsheets/${spreadsheetId}/stats`),
  });

  if (!data || data.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-3 rounded-lg border bg-muted/30 p-3 text-xs">
      {data.map((stat) => {
        const col = columns.find((c) => c.key === stat.key);
        const fmt = (n: number) =>
          col ? formatCellValue(col, n) : n.toLocaleString();
        return (
          <div key={stat.key} className="flex flex-col gap-0.5 rounded-md border bg-card px-3 py-1.5">
            <span className="font-medium">{stat.name}</span>
            <div className="flex gap-3 text-muted-foreground">
              <span title="Total">Σ {fmt(stat.sum)}</span>
              <span title="Average">x̄ {fmt(stat.avg)}</span>
              <span title="Min">↓ {fmt(stat.min)}</span>
              <span title="Max">↑ {fmt(stat.max)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
