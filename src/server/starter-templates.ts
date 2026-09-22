import "server-only";
import type { ColumnType, Prisma, PrismaClient } from "@prisma/client";
import type { ColumnDefinition } from "@/lib/columns";

type DbClient = PrismaClient | Prisma.TransactionClient;

interface StarterColumn {
  key: string;
  name: string;
  type: ColumnType;
  required?: boolean;
  example?: string;
  aiHint?: string;
  options?: string[];
  currency?: string;
}

interface StarterTemplate {
  name: string;
  description: string;
  icon: string;
  voiceExample: string;
  columns: StarterColumn[];
}

/** The single ready-to-use template created for every brand-new workspace. */
export const STARTER_TEMPLATE: StarterTemplate = {
  name: "Solicitudes de compra",
  description: "Lleva el registro de las solicitudes de compra a proveedores.",
  icon: "ShoppingCart",
  voiceExample:
    "Pide 30 cajas de papel A4 a Office Depot a 4.50 cada una, para el próximo viernes, prioridad alta.",
  columns: [
    { key: "vendor_name", name: "Proveedor", type: "TEXT", required: true, aiHint: "El nombre de la empresa proveedora, no de una persona.", example: "Office Depot" },
    { key: "product", name: "Producto", type: "TEXT", required: true, aiHint: "El artículo que se compra.", example: "Papel para impresora A4" },
    { key: "quantity", name: "Cantidad", type: "NUMBER", required: true, aiHint: "Número de unidades pedidas.", example: "30" },
    { key: "unit_price", name: "Precio unitario", type: "CURRENCY", currency: "USD", aiHint: "Precio por unidad.", example: "4.50" },
    { key: "needed_by", name: "Necesario para", type: "DATE", aiHint: "La fecha en que se necesitan los bienes.", example: "2026-08-01" },
    { key: "priority", name: "Prioridad", type: "DROPDOWN", options: ["Baja", "Media", "Alta", "Urgente"], aiHint: "Urgencia de la solicitud." },
    { key: "approved", name: "Aprobado", type: "BOOLEAN", aiHint: "Si la compra ha sido aprobada." },
    { key: "notes", name: "Notas", type: "LONG_TEXT", aiHint: "Cualquier contexto adicional." },
  ],
};

/** ISO (yyyy-MM-dd) date `n` days from today, for realistic sample due dates. */
function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** A few sample rows so a new sheet doesn't open empty. Keyed by column key. */
function sampleRows(): Record<string, string | number | boolean>[] {
  return [
    { vendor_name: "Office Depot", product: "Papel para impresora A4", quantity: 30, unit_price: 4.5, needed_by: daysFromNow(10), priority: "Media", approved: true, notes: "Reabastecimiento trimestral para la oficina principal." },
    { vendor_name: "Dell", product: "Estación de acoplamiento para laptop", quantity: 12, unit_price: 149, needed_by: daysFromNow(21), priority: "Alta", approved: false, notes: "Solicitado por TI para nuevos empleados." },
    { vendor_name: "Staples", product: "Bolígrafos (caja de 50)", quantity: 8, unit_price: 6.75, needed_by: daysFromNow(5), priority: "Baja", approved: true },
  ];
}

/** Immutable column snapshot for the seeded spreadsheet (see ColumnDefinition). */
function buildColumnSnapshot(template: StarterTemplate): ColumnDefinition[] {
  return template.columns.map((c, index) => ({
    key: c.key,
    name: c.name,
    type: c.type,
    position: index,
    required: c.required ?? false,
    defaultValue: null,
    description: null,
    example: c.example ?? null,
    aiHint: c.aiHint ?? null,
    options: c.options ?? null,
    config: c.currency ? { currency: c.currency } : null,
    hidden: false,
  }));
}

/**
 * Seed a freshly-created workspace so it isn't empty on first sign-in: one
 * template, one spreadsheet built from it, and a few sample rows.
 */
export async function seedWorkspace(
  db: DbClient,
  workspaceId: string,
  userId: string,
): Promise<void> {
  const template = STARTER_TEMPLATE;

  await db.template.create({
    data: {
      workspaceId,
      createdById: userId,
      name: template.name,
      description: template.description,
      icon: template.icon,
      voiceExample: template.voiceExample,
      columns: {
        create: template.columns.map((c, index) => ({
          key: c.key,
          name: c.name,
          type: c.type,
          position: index,
          required: c.required ?? false,
          example: c.example ?? null,
          aiHint: c.aiHint ?? null,
          options: (c.options ?? undefined) as Prisma.InputJsonValue | undefined,
          config: c.currency
            ? ({ currency: c.currency } as Prisma.InputJsonValue)
            : undefined,
        })),
      },
    },
  });

  const created = await db.template.findFirstOrThrow({
    where: { workspaceId, name: template.name },
    orderBy: { createdAt: "desc" },
  });

  const spreadsheet = await db.spreadsheet.create({
    data: {
      workspaceId,
      templateId: created.id,
      createdById: userId,
      name: "Solicitudes de compra T3",
      description: "Hoja de cálculo de ejemplo: edita o elimina estas filas para adaptarla.",
      columns: buildColumnSnapshot(template) as unknown as Prisma.InputJsonValue,
    },
  });

  for (const [i, record] of sampleRows().entries()) {
    await db.row.create({
      data: {
        spreadsheetId: spreadsheet.id,
        position: i,
        source: "MANUAL",
        createdById: userId,
        cells: {
          create: Object.entries(record)
            .filter(([, value]) => value !== "" && value !== null && value !== undefined)
            .map(([columnKey, value]) => ({
              columnKey,
              value: value as Prisma.InputJsonValue,
              aiGenerated: false,
            })),
        },
      },
    });
  }
}
