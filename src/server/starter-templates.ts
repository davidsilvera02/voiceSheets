import "server-only";
import type { ColumnType, Prisma, PrismaClient } from "@prisma/client";

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
  columns: StarterColumn[];
}

/** Two ready-to-use templates created for every brand-new workspace. */
export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    name: "Purchase Requests",
    description: "Track purchasing requests from vendors.",
    icon: "ShoppingCart",
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
  },
  {
    name: "Vendor Directory",
    description: "A directory of approved suppliers.",
    icon: "Building2",
    columns: [
      { key: "vendor_name", name: "Vendor", type: "TEXT", required: true, example: "Acme Corp" },
      { key: "category", name: "Category", type: "DROPDOWN", options: ["Office", "IT", "Facilities", "Logistics", "Services"] },
      { key: "contact_email", name: "Contact Email", type: "TEXT", example: "sales@acme.com" },
      { key: "phone", name: "Phone", type: "TEXT", example: "+1 555 010 1234" },
      { key: "rating", name: "Rating", type: "NUMBER", aiHint: "Score from 1 to 5.", example: "4" },
      { key: "preferred", name: "Preferred", type: "BOOLEAN" },
      { key: "notes", name: "Notes", type: "LONG_TEXT" },
    ],
  },
];

/** Create the starter templates in a freshly-created workspace. */
export async function createStarterTemplates(
  db: DbClient,
  workspaceId: string,
  userId: string,
): Promise<void> {
  for (const template of STARTER_TEMPLATES) {
    await db.template.create({
      data: {
        workspaceId,
        createdById: userId,
        name: template.name,
        description: template.description,
        icon: template.icon,
        columns: {
          create: template.columns.map((c, index) => ({
            key: c.key,
            name: c.name,
            type: c.type,
            position: index,
            required: c.required ?? false,
            defaultValue: null,
            description: null,
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
  }
}
