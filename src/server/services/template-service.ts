import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { AuthContext } from "@/server/auth";
import { NotFoundError, ValidationError } from "@/server/http";
import { serializeTemplate } from "@/server/serializers";
import { recordAudit } from "@/server/services/audit-service";
import type { CreateTemplateInput, TemplateColumnInput, UpdateTemplateInput } from "@/lib/validations";

const templateInclude = {
  columns: { orderBy: { position: "asc" } },
  _count: { select: { spreadsheets: true } },
} satisfies Prisma.TemplateInclude;

function keyFromName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^([0-9])/, "col_$1");
  return base || "column";
}

/** Assign stable snake_case keys and sequential positions to columns. */
function normalizeColumns(columns: TemplateColumnInput[]) {
  const used = new Set<string>();
  return columns.map((col, index) => {
    let key = col.key ?? keyFromName(col.name);
    if (used.has(key)) {
      let n = 2;
      while (used.has(`${key}_${n}`)) n++;
      key = `${key}_${n}`;
    }
    used.add(key);
    if (col.type === "DROPDOWN" && (!col.options || col.options.length === 0)) {
      throw new ValidationError(`Dropdown column "${col.name}" needs at least one option`);
    }
    return {
      key,
      name: col.name,
      type: col.type,
      position: col.position ?? index,
      required: col.required,
      defaultValue: col.defaultValue ?? null,
      description: col.description ?? null,
      example: col.example ?? null,
      aiHint: col.aiHint ?? null,
      options: (col.options ?? undefined) as Prisma.InputJsonValue | undefined,
      config: (col.config ?? undefined) as Prisma.InputJsonValue | undefined,
    };
  });
}

export async function listTemplates(
  workspaceId: string,
  opts: { status?: "ACTIVE" | "ARCHIVED"; search?: string; skip: number; take: number },
) {
  const where: Prisma.TemplateWhereInput = {
    workspaceId,
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.search
      ? { name: { contains: opts.search, mode: "insensitive" } }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.template.findMany({
      where,
      include: templateInclude,
      orderBy: { updatedAt: "desc" },
      skip: opts.skip,
      take: opts.take,
    }),
    prisma.template.count({ where }),
  ]);
  return { items: items.map(serializeTemplate), total };
}

export async function getTemplate(workspaceId: string, id: string) {
  const template = await prisma.template.findFirst({
    where: { id, workspaceId },
    include: templateInclude,
  });
  if (!template) throw new NotFoundError("Template");
  return serializeTemplate(template);
}

export async function createTemplate(ctx: AuthContext, input: CreateTemplateInput) {
  const columns = normalizeColumns(input.columns);
  const template = await prisma.template.create({
    data: {
      workspaceId: ctx.workspace.id,
      createdById: ctx.user.id,
      name: input.name,
      description: input.description ?? null,
      icon: input.icon ?? null,
      color: input.color ?? null,
      columns: { create: columns },
    },
    include: templateInclude,
  });
  await recordAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    action: "template.create",
    entityType: "template",
    entityId: template.id,
    metadata: { name: template.name, columns: columns.length },
  });
  return serializeTemplate(template);
}

export async function updateTemplate(ctx: AuthContext, id: string, input: UpdateTemplateInput) {
  const existing = await prisma.template.findFirst({
    where: { id, workspaceId: ctx.workspace.id },
  });
  if (!existing) throw new NotFoundError("Template");

  const template = await prisma.$transaction(async (tx) => {
    await tx.template.update({
      where: { id },
      data: {
        name: input.name ?? undefined,
        description: input.description === undefined ? undefined : input.description,
        icon: input.icon === undefined ? undefined : input.icon,
        color: input.color === undefined ? undefined : input.color,
        status: input.status ?? undefined,
      },
    });

    // Replace column definitions when provided. Existing spreadsheets are
    // unaffected because they hold their own immutable column snapshot.
    if (input.columns) {
      const columns = normalizeColumns(input.columns);
      await tx.templateColumn.deleteMany({ where: { templateId: id } });
      await tx.templateColumn.createMany({
        data: columns.map((c) => ({ ...c, templateId: id })),
      });
    }

    return tx.template.findUniqueOrThrow({ where: { id }, include: templateInclude });
  });

  await recordAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    action: "template.update",
    entityType: "template",
    entityId: id,
  });
  return serializeTemplate(template);
}

export async function duplicateTemplate(ctx: AuthContext, id: string) {
  const source = await prisma.template.findFirst({
    where: { id, workspaceId: ctx.workspace.id },
    include: { columns: true },
  });
  if (!source) throw new NotFoundError("Template");

  const template = await prisma.template.create({
    data: {
      workspaceId: ctx.workspace.id,
      createdById: ctx.user.id,
      name: `${source.name} (Copy)`,
      description: source.description,
      icon: source.icon,
      color: source.color,
      columns: {
        create: source.columns.map((c) => ({
          key: c.key,
          name: c.name,
          type: c.type,
          position: c.position,
          required: c.required,
          defaultValue: c.defaultValue,
          description: c.description,
          example: c.example,
          aiHint: c.aiHint,
          options: (c.options ?? undefined) as Prisma.InputJsonValue | undefined,
          config: (c.config ?? undefined) as Prisma.InputJsonValue | undefined,
        })),
      },
    },
    include: templateInclude,
  });
  await recordAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    action: "template.duplicate",
    entityType: "template",
    entityId: template.id,
    metadata: { sourceId: id },
  });
  return serializeTemplate(template);
}

export async function setTemplateStatus(
  ctx: AuthContext,
  id: string,
  status: "ACTIVE" | "ARCHIVED",
) {
  return updateTemplate(ctx, id, { status });
}

export async function deleteTemplate(ctx: AuthContext, id: string) {
  const existing = await prisma.template.findFirst({
    where: { id, workspaceId: ctx.workspace.id },
    include: { _count: { select: { spreadsheets: true } } },
  });
  if (!existing) throw new NotFoundError("Template");
  await prisma.template.delete({ where: { id } });
  await recordAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    action: "template.delete",
    entityType: "template",
    entityId: id,
    metadata: { name: existing.name },
  });
}
