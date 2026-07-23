import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { ColumnDefinition } from "@/lib/columns";
import type { AuthContext } from "@/server/auth";
import { NotFoundError } from "@/server/http";
import {
  columnToDefinition,
  serializeSpreadsheet,
  serializeSpreadsheetSummary,
  snapshotColumns,
} from "@/server/serializers";
import { recordAudit } from "@/server/services/audit-service";
import type { z } from "zod";
import type { createSpreadsheetSchema, updateSpreadsheetSchema } from "@/lib/validations";

const summaryInclude = {
  template: { select: { name: true } },
  _count: { select: { rows: { where: { deletedAt: null } } } },
} satisfies Prisma.SpreadsheetInclude;

export async function listSpreadsheets(
  workspaceId: string,
  opts: {
    status?: "ACTIVE" | "ARCHIVED";
    favorite?: boolean;
    templateId?: string;
    search?: string;
    skip: number;
    take: number;
  },
) {
  const where: Prisma.SpreadsheetWhereInput = {
    workspaceId,
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.favorite ? { isFavorite: true } : {}),
    ...(opts.templateId ? { templateId: opts.templateId } : {}),
    ...(opts.search ? { name: { contains: opts.search, mode: "insensitive" } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.spreadsheet.findMany({
      where,
      include: summaryInclude,
      orderBy: { lastActivityAt: "desc" },
      skip: opts.skip,
      take: opts.take,
    }),
    prisma.spreadsheet.count({ where }),
  ]);
  return { items: items.map(serializeSpreadsheetSummary), total };
}

export async function getSpreadsheet(workspaceId: string, id: string) {
  const sheet = await prisma.spreadsheet.findFirst({
    where: { id, workspaceId },
    include: summaryInclude,
  });
  if (!sheet) throw new NotFoundError("Spreadsheet");
  return serializeSpreadsheet(sheet);
}

/** Internal helper: load a spreadsheet's raw record + column snapshot. */
export async function requireSpreadsheet(workspaceId: string, id: string) {
  const sheet = await prisma.spreadsheet.findFirst({ where: { id, workspaceId } });
  if (!sheet) throw new NotFoundError("Spreadsheet");
  return { sheet, columns: snapshotColumns(sheet.columns) };
}

export async function createSpreadsheet(
  ctx: AuthContext,
  input: z.infer<typeof createSpreadsheetSchema>,
) {
  const template = await prisma.template.findFirst({
    where: { id: input.templateId, workspaceId: ctx.workspace.id },
    include: { columns: { orderBy: { position: "asc" } } },
  });
  if (!template) throw new NotFoundError("Template");

  const columns: ColumnDefinition[] = template.columns.map((c) => ({
    ...columnToDefinition(c),
    hidden: false,
  }));

  const sheet = await prisma.spreadsheet.create({
    data: {
      workspaceId: ctx.workspace.id,
      templateId: template.id,
      createdById: ctx.user.id,
      name: input.name,
      description: input.description ?? null,
      columns: columns as unknown as Prisma.InputJsonValue,
    },
    include: summaryInclude,
  });
  await recordAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    action: "spreadsheet.create",
    entityType: "spreadsheet",
    entityId: sheet.id,
    metadata: { name: sheet.name, templateId: template.id },
  });
  return serializeSpreadsheet(sheet);
}

export async function updateSpreadsheet(
  ctx: AuthContext,
  id: string,
  input: z.infer<typeof updateSpreadsheetSchema>,
) {
  const existing = await prisma.spreadsheet.findFirst({
    where: { id, workspaceId: ctx.workspace.id },
  });
  if (!existing) throw new NotFoundError("Spreadsheet");

  let columnsUpdate: Prisma.InputJsonValue | undefined;
  if (input.columns) {
    const current = snapshotColumns(existing.columns);
    const patchByKey = new Map(input.columns.map((c) => [c.key, c]));
    const next = current.map((col) => {
      const patch = patchByKey.get(col.key);
      if (!patch) return col;
      return {
        ...col,
        hidden: patch.hidden ?? col.hidden,
        width: patch.width ?? col.width,
        position: patch.position ?? col.position,
      };
    });
    next.sort((a, b) => a.position - b.position);
    columnsUpdate = next as unknown as Prisma.InputJsonValue;
  }

  const sheet = await prisma.spreadsheet.update({
    where: { id },
    data: {
      name: input.name ?? undefined,
      description: input.description === undefined ? undefined : input.description,
      status: input.status ?? undefined,
      isFavorite: input.isFavorite ?? undefined,
      columns: columnsUpdate,
      lastActivityAt: new Date(),
    },
    include: summaryInclude,
  });
  return serializeSpreadsheet(sheet);
}

export async function duplicateSpreadsheet(ctx: AuthContext, id: string, withRows: boolean) {
  const source = await prisma.spreadsheet.findFirst({
    where: { id, workspaceId: ctx.workspace.id },
  });
  if (!source) throw new NotFoundError("Spreadsheet");

  const sourceRows = withRows
    ? await prisma.row.findMany({
        where: { spreadsheetId: id, deletedAt: null },
        include: { cells: true },
        orderBy: { position: "asc" },
      })
    : [];

  const sheet = await prisma.spreadsheet.create({
    data: {
      workspaceId: ctx.workspace.id,
      templateId: source.templateId,
      createdById: ctx.user.id,
      name: `${source.name} (Copy)`,
      description: source.description,
      columns: source.columns as Prisma.InputJsonValue,
      rows: withRows
        ? {
            create: sourceRows.map((row, index) => ({
              position: index,
              source: row.source,
              createdById: ctx.user.id,
              cells: {
                create: row.cells.map((cell) => ({
                  columnKey: cell.columnKey,
                  value: (cell.value ?? undefined) as Prisma.InputJsonValue | undefined,
                })),
              },
            })),
          }
        : undefined,
    },
    include: summaryInclude,
  });
  await recordAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    action: "spreadsheet.duplicate",
    entityType: "spreadsheet",
    entityId: sheet.id,
    metadata: { sourceId: id, withRows },
  });
  return serializeSpreadsheet(sheet);
}

export async function deleteSpreadsheet(ctx: AuthContext, id: string) {
  const existing = await prisma.spreadsheet.findFirst({
    where: { id, workspaceId: ctx.workspace.id },
  });
  if (!existing) throw new NotFoundError("Spreadsheet");
  await prisma.spreadsheet.delete({ where: { id } });
  await recordAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    action: "spreadsheet.delete",
    entityType: "spreadsheet",
    entityId: id,
    metadata: { name: existing.name },
  });
}
