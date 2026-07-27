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
  name: "Purchase Requests",
  description: "Track purchasing requests from vendors.",
  icon: "ShoppingCart",
  voiceExample:
    "Order 30 boxes of A4 paper from Office Depot at 4.50 each, needed by next Friday, high priority.",
  columns: [
    { key: "vendor_name", name: "Vendor", type: "TEXT", required: true, aiHint: "The supplier's company name, not a person.", example: "Office Depot" },
    { key: "product", name: "Product", type: "TEXT", required: true, aiHint: "The item being purchased.", example: "A4 printer paper" },
    { key: "quantity", name: "Quantity", type: "NUMBER", required: true, aiHint: "Number of units ordered.", example: "30" },
    { key: "unit_price", name: "Unit Price", type: "CURRENCY", currency: "USD", aiHint: "Price per single unit.", example: "4.50" },
    { key: "needed_by", name: "Needed By", type: "DATE", aiHint: "The date the goods are required.", example: "2026-08-01" },
    { key: "priority", name: "Priority", type: "DROPDOWN", options: ["Low", "Medium", "High", "Urgent"], aiHint: "Urgency of the request." },
    { key: "approved", name: "Approved", type: "BOOLEAN", aiHint: "Whether the purchase has been approved." },
    { key: "notes", name: "Notes", type: "LONG_TEXT", aiHint: "Any extra context." },
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
    { vendor_name: "Office Depot", product: "A4 printer paper", quantity: 30, unit_price: 4.5, needed_by: daysFromNow(10), priority: "Medium", approved: true, notes: "Quarterly restock for the main office." },
    { vendor_name: "Dell", product: "Laptop docking station", quantity: 12, unit_price: 149, needed_by: daysFromNow(21), priority: "High", approved: false, notes: "Requested by IT for new hires." },
    { vendor_name: "Staples", product: "Ballpoint pens (box of 50)", quantity: 8, unit_price: 6.75, needed_by: daysFromNow(5), priority: "Low", approved: true },
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
      name: "Q3 Purchase Requests",
      description: "Sample spreadsheet — edit or delete these rows to make it your own.",
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
