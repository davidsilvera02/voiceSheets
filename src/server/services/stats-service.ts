import "server-only";
import { prisma } from "@/lib/db";
import { parseNumeric } from "@/lib/columns";
import type { ColumnStat, DuplicateGroup } from "@/lib/types";
import { requireSpreadsheet } from "@/server/services/spreadsheet-service";

/** Totals / averages / min / max for every numeric column. */
export async function computeStats(workspaceId: string, spreadsheetId: string): Promise<ColumnStat[]> {
  const { columns } = await requireSpreadsheet(workspaceId, spreadsheetId);
  const numericColumns = columns.filter((c) => c.type === "NUMBER" || c.type === "CURRENCY");
  if (numericColumns.length === 0) return [];

  const rows = await prisma.row.findMany({
    where: { spreadsheetId, deletedAt: null },
    include: { cells: { where: { columnKey: { in: numericColumns.map((c) => c.key) } } } },
  });

  return numericColumns.map((column) => {
    const nums: number[] = [];
    for (const row of rows) {
      const cell = row.cells.find((c) => c.columnKey === column.key);
      const n = parseNumeric(cell?.value);
      if (n !== null) nums.push(n);
    }
    const count = nums.length;
    const sum = nums.reduce((a, b) => a + b, 0);
    return {
      key: column.key,
      name: column.name,
      count,
      sum,
      avg: count ? sum / count : 0,
      min: count ? Math.min(...nums) : 0,
      max: count ? Math.max(...nums) : 0,
    };
  });
}

/** Group rows whose full value signatures are identical (duplicate detection). */
export async function findDuplicates(
  workspaceId: string,
  spreadsheetId: string,
): Promise<DuplicateGroup[]> {
  await requireSpreadsheet(workspaceId, spreadsheetId);
  const rows = await prisma.row.findMany({
    where: { spreadsheetId, deletedAt: null },
    include: { cells: true },
    orderBy: { position: "asc" },
  });

  const groups = new Map<string, string[]>();
  for (const row of rows) {
    const signature = row.cells
      .slice()
      .sort((a, b) => a.columnKey.localeCompare(b.columnKey))
      .map((c) => `${c.columnKey}=${String(c.value ?? "").trim().toLowerCase()}`)
      .join("|");
    if (!signature) continue;
    const list = groups.get(signature) ?? [];
    list.push(row.id);
    groups.set(signature, list);
  }

  return Array.from(groups.entries())
    .filter(([, ids]) => ids.length > 1)
    .map(([signature, rowIds]) => ({ signature, rowIds }));
}

/** Distinct previously-entered values for a column (vendor/product autocomplete). */
export async function suggestValues(
  workspaceId: string,
  spreadsheetId: string,
  columnKey: string,
  query: string,
  limit = 8,
): Promise<string[]> {
  await requireSpreadsheet(workspaceId, spreadsheetId);
  // Suggest across the whole workspace so vendors/products carry between sheets.
  const cells = await prisma.cell.findMany({
    where: {
      columnKey,
      row: { spreadsheet: { workspaceId }, deletedAt: null },
    },
    select: { value: true },
    take: 2000,
  });
  const counts = new Map<string, number>();
  const q = query.trim().toLowerCase();
  for (const cell of cells) {
    const value = String(cell.value ?? "").trim();
    if (!value) continue;
    if (q && !value.toLowerCase().includes(q)) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value]) => value);
}
