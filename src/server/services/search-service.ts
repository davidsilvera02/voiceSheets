import "server-only";
import { prisma } from "@/lib/db";
import type { GlobalSearchResult } from "@/lib/types";

/** Global search across templates, spreadsheets, and row content. */
export async function globalSearch(
  workspaceId: string,
  query: string,
  limit = 8,
): Promise<GlobalSearchResult> {
  const q = query.trim();
  if (!q) return { templates: [], spreadsheets: [], rows: [] };

  const [templates, spreadsheets, cells] = await Promise.all([
    prisma.template.findMany({
      where: {
        workspaceId,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      take: limit,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.spreadsheet.findMany({
      where: {
        workspaceId,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      include: { template: { select: { name: true } } },
      take: limit,
      orderBy: { lastActivityAt: "desc" },
    }),
    prisma.cell.findMany({
      where: {
        row: { deletedAt: null, spreadsheet: { workspaceId } },
        // Json string_contains matches serialized text values.
        value: { string_contains: q },
      },
      include: {
        row: { include: { spreadsheet: { select: { id: true, name: true } } } },
      },
      take: limit * 3,
    }),
  ]);

  // De-duplicate row hits and build readable snippets.
  const seenRows = new Set<string>();
  const rows: GlobalSearchResult["rows"] = [];
  for (const cell of cells) {
    if (seenRows.has(cell.rowId)) continue;
    seenRows.add(cell.rowId);
    rows.push({
      id: cell.rowId,
      spreadsheetId: cell.row.spreadsheet.id,
      spreadsheetName: cell.row.spreadsheet.name,
      snippet: `${cell.columnKey}: ${String(cell.value ?? "")}`,
    });
    if (rows.length >= limit) break;
  }

  return {
    templates: templates.map((t) => ({ id: t.id, name: t.name, description: t.description })),
    spreadsheets: spreadsheets.map((s) => ({
      id: s.id,
      name: s.name,
      templateName: s.template?.name ?? null,
    })),
    rows,
  };
}
