import "server-only";
import type {
  Cell,
  Prisma,
  Row,
  Spreadsheet,
  Template,
  TemplateColumn,
} from "@prisma/client";
import type { CellValue, ColumnConfig, ColumnDefinition } from "@/lib/columns";
import type {
  AuditLogDTO,
  HistoryEntryDTO,
  RowDTO,
  SpreadsheetDTO,
  SpreadsheetSummaryDTO,
  TemplateDTO,
} from "@/lib/types";

export function columnToDefinition(col: TemplateColumn): ColumnDefinition {
  return {
    key: col.key,
    name: col.name,
    type: col.type,
    position: col.position,
    required: col.required,
    defaultValue: col.defaultValue,
    description: col.description,
    example: col.example,
    aiHint: col.aiHint,
    options: (col.options as string[] | null) ?? null,
    config: (col.config as ColumnConfig | null) ?? null,
  };
}

/** The Json snapshot stored on a Spreadsheet is already ColumnDefinition[]. */
export function snapshotColumns(value: Prisma.JsonValue | null): ColumnDefinition[] {
  if (!Array.isArray(value)) return [];
  return (value as unknown as ColumnDefinition[])
    .slice()
    .sort((a, b) => a.position - b.position);
}

export function serializeTemplate(
  template: Template & {
    columns: TemplateColumn[];
    _count?: { spreadsheets: number };
  },
): TemplateDTO {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    icon: template.icon,
    color: template.color,
    status: template.status,
    columns: template.columns
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((c) => ({ id: c.id, ...columnToDefinition(c) })),
    spreadsheetCount: template._count?.spreadsheets ?? 0,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

type SpreadsheetWithCounts = Spreadsheet & {
  template?: { name: string } | null;
  _count?: { rows: number };
};

export function serializeSpreadsheetSummary(s: SpreadsheetWithCounts): SpreadsheetSummaryDTO {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    status: s.status,
    isFavorite: s.isFavorite,
    templateId: s.templateId,
    templateName: s.template?.name ?? null,
    rowCount: s._count?.rows ?? 0,
    columnCount: snapshotColumns(s.columns).length,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    lastActivityAt: s.lastActivityAt.toISOString(),
  };
}

export function serializeSpreadsheet(s: SpreadsheetWithCounts): SpreadsheetDTO {
  return {
    ...serializeSpreadsheetSummary(s),
    columns: snapshotColumns(s.columns),
  };
}

export function serializeRow(row: Row & { cells: Cell[] }): RowDTO {
  const values: Record<string, CellValue> = {};
  const meta: RowDTO["meta"] = {};
  for (const cell of row.cells) {
    values[cell.columnKey] = (cell.value as CellValue) ?? null;
    meta[cell.columnKey] = {
      aiGenerated: cell.aiGenerated,
      confidence: cell.confidence,
    };
  }
  return {
    id: row.id,
    position: row.position,
    source: row.source,
    values,
    meta,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeHistory(
  h: Prisma.RowHistoryGetPayload<{ include: { actor: true } }>,
): HistoryEntryDTO {
  return {
    id: h.id,
    rowId: h.rowId,
    changeType: h.changeType,
    columnKey: h.columnKey,
    previousValue: (h.previousValue as CellValue) ?? null,
    newValue: (h.newValue as CellValue) ?? null,
    snapshot: (h.snapshot as Record<string, CellValue> | null) ?? null,
    actorName: h.actor?.name ?? h.actor?.email ?? null,
    createdAt: h.createdAt.toISOString(),
  };
}

export function serializeAudit(
  a: Prisma.AuditLogGetPayload<{ include: { actor: true } }>,
): AuditLogDTO {
  return {
    id: a.id,
    action: a.action,
    entityType: a.entityType,
    entityId: a.entityId,
    actorName: a.actor?.name ?? a.actor?.email ?? null,
    metadata: (a.metadata as Record<string, unknown> | null) ?? null,
    createdAt: a.createdAt.toISOString(),
  };
}
