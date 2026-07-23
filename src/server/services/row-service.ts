import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  type CellValue,
  type ColumnDefinition,
  coerceValue,
  validateCellValue,
} from "@/lib/columns";
import type { AuthContext } from "@/server/auth";
import { NotFoundError, ValidationError } from "@/server/http";
import { serializeRow } from "@/server/serializers";
import { requireSpreadsheet } from "@/server/services/spreadsheet-service";
import { recordAudit } from "@/server/services/audit-service";
import { recordChange, recordRowUpdate } from "@/server/services/history-service";

type DbClient = PrismaClient | Prisma.TransactionClient;

export interface CellMetaInput {
  aiGenerated?: boolean;
  confidence?: number | null;
}

/** Coerce + validate a set of values against the given columns. */
function coerceAndValidate(
  columns: ColumnDefinition[],
  values: Record<string, unknown>,
  { onlyKeys }: { onlyKeys?: string[] } = {},
): Record<string, CellValue> {
  const errors: Record<string, string> = {};
  const result: Record<string, CellValue> = {};
  const target = onlyKeys
    ? columns.filter((c) => onlyKeys.includes(c.key))
    : columns;
  for (const column of target) {
    if (onlyKeys && !(column.key in values)) continue;
    const coerced = coerceValue(column, values[column.key]);
    result[column.key] = coerced;
    const error = validateCellValue(column, coerced);
    if (error) errors[column.key] = error;
  }
  if (Object.keys(errors).length > 0) {
    throw new ValidationError("Some fields are invalid", { fields: errors });
  }
  return result;
}

/** Persist a set of coerced values as cells; null values remove the cell. */
async function writeCells(
  db: DbClient,
  rowId: string,
  values: Record<string, CellValue>,
  meta: Record<string, CellMetaInput> = {},
) {
  for (const [columnKey, value] of Object.entries(values)) {
    if (value === null || value === undefined) {
      await db.cell.deleteMany({ where: { rowId, columnKey } });
      continue;
    }
    const cellMeta = meta[columnKey] ?? {};
    await db.cell.upsert({
      where: { rowId_columnKey: { rowId, columnKey } },
      create: {
        rowId,
        columnKey,
        value: value as Prisma.InputJsonValue,
        aiGenerated: cellMeta.aiGenerated ?? false,
        confidence: cellMeta.confidence ?? null,
      },
      update: {
        value: value as Prisma.InputJsonValue,
        aiGenerated: cellMeta.aiGenerated ?? false,
        confidence: cellMeta.confidence ?? null,
      },
    });
  }
}

function cellsToValues(cells: { columnKey: string; value: Prisma.JsonValue }[]) {
  const values: Record<string, CellValue> = {};
  for (const cell of cells) values[cell.columnKey] = (cell.value as CellValue) ?? null;
  return values;
}

export async function listRows(
  workspaceId: string,
  spreadsheetId: string,
  opts: { search?: string; skip?: number; take?: number } = {},
) {
  await requireSpreadsheet(workspaceId, spreadsheetId);
  let rows = await prisma.row.findMany({
    where: { spreadsheetId, deletedAt: null },
    include: { cells: true },
    orderBy: { position: "asc" },
  });

  if (opts.search) {
    const q = opts.search.toLowerCase();
    rows = rows.filter((row) =>
      row.cells.some((c) => String(c.value ?? "").toLowerCase().includes(q)),
    );
  }
  const total = rows.length;
  const skip = opts.skip ?? 0;
  const take = opts.take ?? rows.length;
  const page = rows.slice(skip, skip + take);
  return { items: page.map(serializeRow), total };
}

export async function createRow(
  ctx: AuthContext,
  spreadsheetId: string,
  input: { values: Record<string, unknown>; source?: "MANUAL" | "VOICE" | "AI" | "IMPORT" },
  meta: Record<string, CellMetaInput> = {},
) {
  const { columns } = await requireSpreadsheet(ctx.workspace.id, spreadsheetId);
  const values = coerceAndValidate(columns, input.values);

  const row = await prisma.$transaction(async (tx) => {
    const last = await tx.row.findFirst({
      where: { spreadsheetId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const created = await tx.row.create({
      data: {
        spreadsheetId,
        position: (last?.position ?? -1) + 1,
        source: input.source ?? "MANUAL",
        createdById: ctx.user.id,
      },
    });
    await writeCells(tx, created.id, values, meta);
    await recordChange(
      {
        spreadsheetId,
        rowId: created.id,
        actorId: ctx.user.id,
        changeType: "CREATE",
        newValue: values,
        snapshot: values,
      },
      tx,
    );
    await tx.spreadsheet.update({
      where: { id: spreadsheetId },
      data: { lastActivityAt: new Date() },
    });
    return tx.row.findUniqueOrThrow({ where: { id: created.id }, include: { cells: true } });
  });

  await recordAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    action: input.source === "VOICE" ? "row.voice_commit" : "row.create",
    entityType: "row",
    entityId: row.id,
    metadata: { spreadsheetId, source: input.source ?? "MANUAL" },
  });
  return serializeRow(row);
}

export async function updateRow(
  ctx: AuthContext,
  spreadsheetId: string,
  rowId: string,
  input: { values: Record<string, unknown> },
) {
  const { columns } = await requireSpreadsheet(ctx.workspace.id, spreadsheetId);
  const existing = await prisma.row.findFirst({
    where: { id: rowId, spreadsheetId, deletedAt: null },
    include: { cells: true },
  });
  if (!existing) throw new NotFoundError("Row");

  const before = cellsToValues(existing.cells);
  const patch = coerceAndValidate(columns, input.values, {
    onlyKeys: Object.keys(input.values),
  });
  const after = { ...before, ...patch };

  const row = await prisma.$transaction(async (tx) => {
    await writeCells(tx, rowId, patch);
    await recordRowUpdate(
      { spreadsheetId, rowId, actorId: ctx.user.id, before, after },
      tx,
    );
    await tx.spreadsheet.update({
      where: { id: spreadsheetId },
      data: { lastActivityAt: new Date() },
    });
    return tx.row.findUniqueOrThrow({ where: { id: rowId }, include: { cells: true } });
  });
  return serializeRow(row);
}

export async function bulkUpdateRows(
  ctx: AuthContext,
  spreadsheetId: string,
  rowIds: string[],
  values: Record<string, unknown>,
) {
  const { columns } = await requireSpreadsheet(ctx.workspace.id, spreadsheetId);
  const patch = coerceAndValidate(columns, values, { onlyKeys: Object.keys(values) });
  const rows = await prisma.row.findMany({
    where: { id: { in: rowIds }, spreadsheetId, deletedAt: null },
    include: { cells: true },
  });

  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const before = cellsToValues(row.cells);
      await writeCells(tx, row.id, patch);
      await recordRowUpdate(
        { spreadsheetId, rowId: row.id, actorId: ctx.user.id, before, after: { ...before, ...patch } },
        tx,
      );
    }
    await tx.spreadsheet.update({ where: { id: spreadsheetId }, data: { lastActivityAt: new Date() } });
  });

  await recordAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    action: "row.bulk_update",
    entityType: "spreadsheet",
    entityId: spreadsheetId,
    metadata: { count: rows.length, keys: Object.keys(patch) },
  });
  return { updated: rows.length };
}

export async function deleteRow(ctx: AuthContext, spreadsheetId: string, rowId: string) {
  const { columns: _c } = await requireSpreadsheet(ctx.workspace.id, spreadsheetId);
  void _c;
  const existing = await prisma.row.findFirst({
    where: { id: rowId, spreadsheetId, deletedAt: null },
    include: { cells: true },
  });
  if (!existing) throw new NotFoundError("Row");
  const snapshot = cellsToValues(existing.cells);

  await prisma.$transaction(async (tx) => {
    await tx.row.update({ where: { id: rowId }, data: { deletedAt: new Date() } });
    await recordChange(
      { spreadsheetId, rowId, actorId: ctx.user.id, changeType: "DELETE", previousValue: snapshot, snapshot },
      tx,
    );
    await tx.spreadsheet.update({ where: { id: spreadsheetId }, data: { lastActivityAt: new Date() } });
  });
  await recordAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    action: "row.delete",
    entityType: "row",
    entityId: rowId,
    metadata: { spreadsheetId },
  });
}

export async function bulkDeleteRows(ctx: AuthContext, spreadsheetId: string, rowIds: string[]) {
  await requireSpreadsheet(ctx.workspace.id, spreadsheetId);
  const rows = await prisma.row.findMany({
    where: { id: { in: rowIds }, spreadsheetId, deletedAt: null },
    include: { cells: true },
  });
  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const snapshot = cellsToValues(row.cells);
      await tx.row.update({ where: { id: row.id }, data: { deletedAt: new Date() } });
      await recordChange(
        { spreadsheetId, rowId: row.id, actorId: ctx.user.id, changeType: "DELETE", previousValue: snapshot, snapshot },
        tx,
      );
    }
    await tx.spreadsheet.update({ where: { id: spreadsheetId }, data: { lastActivityAt: new Date() } });
  });
  await recordAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    action: "row.bulk_delete",
    entityType: "spreadsheet",
    entityId: spreadsheetId,
    metadata: { count: rows.length },
  });
  return { deleted: rows.length };
}

/** Restore a row to a prior snapshot captured in version history. */
export async function restoreRowVersion(
  ctx: AuthContext,
  spreadsheetId: string,
  rowId: string,
  historyId: string,
) {
  const { columns } = await requireSpreadsheet(ctx.workspace.id, spreadsheetId);
  const entry = await prisma.rowHistory.findFirst({
    where: { id: historyId, spreadsheetId, rowId },
  });
  if (!entry || !entry.snapshot) throw new NotFoundError("History snapshot");
  const snapshot = coerceAndValidate(columns, entry.snapshot as Record<string, unknown>);

  const row = await prisma.$transaction(async (tx) => {
    await tx.row.update({ where: { id: rowId }, data: { deletedAt: null } });
    // Clear existing cells then write the restored snapshot.
    await tx.cell.deleteMany({ where: { rowId } });
    await writeCells(tx, rowId, snapshot);
    await recordChange(
      { spreadsheetId, rowId, actorId: ctx.user.id, changeType: "RESTORE", newValue: snapshot, snapshot },
      tx,
    );
    await tx.spreadsheet.update({ where: { id: spreadsheetId }, data: { lastActivityAt: new Date() } });
    return tx.row.findUniqueOrThrow({ where: { id: rowId }, include: { cells: true } });
  });
  await recordAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    action: "row.restore",
    entityType: "row",
    entityId: rowId,
    metadata: { spreadsheetId, historyId },
  });
  return serializeRow(row);
}

/** Bulk create rows (used by import). Skips whole-row validation failures. */
export async function importRows(
  ctx: AuthContext,
  spreadsheetId: string,
  records: Record<string, unknown>[],
) {
  const { columns } = await requireSpreadsheet(ctx.workspace.id, spreadsheetId);
  let imported = 0;
  const errors: { index: number; message: string }[] = [];

  await prisma.$transaction(async (tx) => {
    const last = await tx.row.findFirst({
      where: { spreadsheetId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    let position = (last?.position ?? -1) + 1;
    for (let i = 0; i < records.length; i++) {
      try {
        const values = coerceAndValidate(columns, records[i]!);
        const created = await tx.row.create({
          data: { spreadsheetId, position: position++, source: "IMPORT", createdById: ctx.user.id },
        });
        await writeCells(tx, created.id, values);
        await recordChange(
          { spreadsheetId, rowId: created.id, actorId: ctx.user.id, changeType: "IMPORT", newValue: values, snapshot: values },
          tx,
        );
        imported++;
      } catch (error) {
        errors.push({ index: i, message: error instanceof Error ? error.message : "Invalid row" });
      }
    }
    await tx.spreadsheet.update({ where: { id: spreadsheetId }, data: { lastActivityAt: new Date() } });
  });

  await recordAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    action: "row.import",
    entityType: "spreadsheet",
    entityId: spreadsheetId,
    metadata: { imported, failed: errors.length },
  });
  return { imported, failed: errors.length, errors };
}
