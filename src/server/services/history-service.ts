import "server-only";
import type { HistoryChangeType, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { CellValue } from "@/lib/columns";
import { serializeHistory } from "@/server/serializers";

type DbClient = PrismaClient | Prisma.TransactionClient;

export interface RecordChangeInput {
  spreadsheetId: string;
  rowId: string | null;
  actorId?: string | null;
  changeType: HistoryChangeType;
  columnKey?: string | null;
  previousValue?: CellValue | Record<string, CellValue> | null;
  newValue?: CellValue | Record<string, CellValue> | null;
  snapshot?: Record<string, CellValue> | null;
}

/** Persist a single version-history entry. */
export async function recordChange(input: RecordChangeInput, db: DbClient = prisma) {
  await db.rowHistory.create({
    data: {
      spreadsheetId: input.spreadsheetId,
      rowId: input.rowId,
      actorId: input.actorId ?? null,
      changeType: input.changeType,
      columnKey: input.columnKey ?? null,
      previousValue: (input.previousValue ?? undefined) as Prisma.InputJsonValue | undefined,
      newValue: (input.newValue ?? undefined) as Prisma.InputJsonValue | undefined,
      snapshot: (input.snapshot ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

/** Compute the diff between two value records and record one history entry. */
export async function recordRowUpdate(
  params: {
    spreadsheetId: string;
    rowId: string;
    actorId?: string | null;
    before: Record<string, CellValue>;
    after: Record<string, CellValue>;
  },
  db: DbClient = prisma,
) {
  const changedKeys = Object.keys(params.after).filter(
    (key) => JSON.stringify(params.after[key] ?? null) !== JSON.stringify(params.before[key] ?? null),
  );
  if (changedKeys.length === 0) return;

  const prev: Record<string, CellValue> = {};
  const next: Record<string, CellValue> = {};
  for (const key of changedKeys) {
    prev[key] = params.before[key] ?? null;
    next[key] = params.after[key] ?? null;
  }

  await recordChange(
    {
      spreadsheetId: params.spreadsheetId,
      rowId: params.rowId,
      actorId: params.actorId,
      changeType: "UPDATE",
      columnKey: changedKeys.length === 1 ? changedKeys[0] : null,
      previousValue: changedKeys.length === 1 ? prev[changedKeys[0]!] : prev,
      newValue: changedKeys.length === 1 ? next[changedKeys[0]!] : next,
      snapshot: params.after,
    },
    db,
  );
}

export async function listSpreadsheetHistory(
  spreadsheetId: string,
  { skip, take }: { skip: number; take: number },
) {
  const [items, total] = await Promise.all([
    prisma.rowHistory.findMany({
      where: { spreadsheetId },
      include: { actor: true },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.rowHistory.count({ where: { spreadsheetId } }),
  ]);
  return { items: items.map(serializeHistory), total };
}

export async function listRowHistory(rowId: string) {
  const items = await prisma.rowHistory.findMany({
    where: { rowId },
    include: { actor: true },
    orderBy: { createdAt: "desc" },
  });
  return items.map(serializeHistory);
}
