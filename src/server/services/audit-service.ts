import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { serializeAudit } from "@/server/serializers";

type DbClient = PrismaClient | Prisma.TransactionClient;

export interface AuditInput {
  workspaceId: string;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

/** Append an audit-log entry. Never throws into the caller's happy path. */
export async function recordAudit(input: AuditInput, db: DbClient = prisma): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        workspaceId: input.workspaceId,
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        metadata: input.metadata ?? undefined,
      },
    });
  } catch (error) {
    console.error("[voicesheets] Failed to record audit log:", error);
  }
}

export async function listAudit(
  workspaceId: string,
  { skip, take }: { skip: number; take: number },
) {
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: { workspaceId },
      include: { actor: true },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.auditLog.count({ where: { workspaceId } }),
  ]);
  return { items: items.map(serializeAudit), total };
}
