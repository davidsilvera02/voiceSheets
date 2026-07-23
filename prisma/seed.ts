/**
 * Seed script — creates the local dev user, a personal workspace, sample
 * templates, and a demo spreadsheet with rows so the app is populated on first
 * run. Idempotent: it no-ops if the workspace already has templates.
 *
 * Run with: npm run db:seed
 */
import { PrismaClient, type ColumnType } from "@prisma/client";

const prisma = new PrismaClient();

interface SeedColumn {
  key: string;
  name: string;
  type: ColumnType;
  required?: boolean;
  description?: string;
  example?: string;
  aiHint?: string;
  options?: string[];
  currency?: string;
}

function toColumns(cols: SeedColumn[]) {
  return cols.map((c, index) => ({
    key: c.key,
    name: c.name,
    type: c.type,
    position: index,
    required: c.required ?? false,
    defaultValue: null,
    description: c.description ?? null,
    example: c.example ?? null,
    aiHint: c.aiHint ?? null,
    options: c.options ?? undefined,
    config: c.currency ? { currency: c.currency } : undefined,
  }));
}

/** ColumnDefinition[] snapshot for a spreadsheet, derived from seed columns. */
function toSnapshot(cols: SeedColumn[]) {
  return cols.map((c, index) => ({
    key: c.key,
    name: c.name,
    type: c.type,
    position: index,
    required: c.required ?? false,
    defaultValue: null,
    description: c.description ?? null,
    example: c.example ?? null,
    aiHint: c.aiHint ?? null,
    options: c.options ?? null,
    config: c.currency ? { currency: c.currency } : null,
    hidden: false,
  }));
}

const purchaseColumns: SeedColumn[] = [
  { key: "vendor_name", name: "Vendor", type: "TEXT", required: true, aiHint: "The supplier's company name, not a person.", example: "Office Depot" },
  { key: "product", name: "Product", type: "TEXT", required: true, aiHint: "The item being purchased.", example: "A4 printer paper" },
  { key: "quantity", name: "Quantity", type: "NUMBER", required: true, aiHint: "Number of units ordered.", example: "30" },
  { key: "unit_price", name: "Unit Price", type: "CURRENCY", currency: "USD", aiHint: "Price per single unit.", example: "4.50" },
  { key: "needed_by", name: "Needed By", type: "DATE", aiHint: "The date the goods are required.", example: "2026-08-01" },
  { key: "priority", name: "Priority", type: "DROPDOWN", options: ["Low", "Medium", "High", "Urgent"], aiHint: "Urgency of the request." },
  { key: "approved", name: "Approved", type: "BOOLEAN", aiHint: "Whether the purchase has been approved." },
  { key: "notes", name: "Notes", type: "LONG_TEXT", aiHint: "Any extra context." },
];

const vendorColumns: SeedColumn[] = [
  { key: "vendor_name", name: "Vendor", type: "TEXT", required: true, example: "Acme Corp" },
  { key: "category", name: "Category", type: "DROPDOWN", options: ["Office", "IT", "Facilities", "Logistics", "Services"] },
  { key: "contact_email", name: "Contact Email", type: "TEXT", example: "sales@acme.com" },
  { key: "phone", name: "Phone", type: "TEXT", example: "+1 555 010 1234" },
  { key: "rating", name: "Rating", type: "NUMBER", aiHint: "Score from 1 to 5.", example: "4" },
  { key: "preferred", name: "Preferred", type: "BOOLEAN" },
  { key: "notes", name: "Notes", type: "LONG_TEXT" },
];

const inventoryColumns: SeedColumn[] = [
  { key: "sku", name: "SKU", type: "TEXT", required: true, example: "PPR-A4-500" },
  { key: "product", name: "Product", type: "TEXT", required: true, example: "A4 paper (500 sheets)" },
  { key: "on_hand", name: "On Hand", type: "NUMBER", example: "120" },
  { key: "reorder_point", name: "Reorder Point", type: "NUMBER", example: "40" },
  { key: "unit_cost", name: "Unit Cost", type: "CURRENCY", currency: "USD", example: "3.20" },
  { key: "location", name: "Location", type: "DROPDOWN", options: ["Warehouse A", "Warehouse B", "Store"] },
];

const demoRows: Record<string, string | number | boolean>[] = [
  { vendor_name: "Office Depot", product: "A4 printer paper", quantity: 30, unit_price: 4.5, needed_by: "2026-08-01", priority: "High", approved: true, notes: "For Q3 restock" },
  { vendor_name: "Staples", product: "Ballpoint pens (box)", quantity: 12, unit_price: 6.25, needed_by: "2026-07-28", priority: "Medium", approved: false, notes: "" },
  { vendor_name: "Acme Corp", product: "Laptop stands", quantity: 8, unit_price: 34.99, needed_by: "2026-08-15", priority: "Low", approved: false, notes: "Ergonomics project" },
  { vendor_name: "TechSupply Co", product: "USB-C cables", quantity: 50, unit_price: 8.0, needed_by: "2026-07-30", priority: "Urgent", approved: true, notes: "Replace failing stock" },
];

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "dev@voicesheets.local" },
    update: {},
    create: {
      email: "dev@voicesheets.local",
      name: "Dev User",
      settings: { create: {} },
    },
  });

  let membership = await prisma.membership.findFirst({
    where: { userId: user.id },
    include: { workspace: true },
  });
  if (!membership) {
    const workspace = await prisma.workspace.create({
      data: {
        name: "My Workspace",
        slug: `workspace-${user.id.slice(-6)}`,
        ownerId: user.id,
        memberships: { create: { userId: user.id, role: "OWNER" } },
      },
    });
    membership = await prisma.membership.findFirstOrThrow({
      where: { userId: user.id, workspaceId: workspace.id },
      include: { workspace: true },
    });
  }
  const workspaceId = membership.workspace.id;

  const existing = await prisma.template.count({ where: { workspaceId } });
  if (existing > 0) {
    console.log("↩︎  Workspace already seeded — skipping.");
    return;
  }

  const purchaseTemplate = await prisma.template.create({
    data: {
      workspaceId,
      createdById: user.id,
      name: "Purchase Requests",
      description: "Track purchasing requests from vendors.",
      icon: "ShoppingCart",
      columns: { create: toColumns(purchaseColumns) },
    },
  });

  await prisma.template.create({
    data: {
      workspaceId,
      createdById: user.id,
      name: "Vendor Directory",
      description: "A directory of approved suppliers.",
      icon: "Building2",
      columns: { create: toColumns(vendorColumns) },
    },
  });

  await prisma.template.create({
    data: {
      workspaceId,
      createdById: user.id,
      name: "Product Inventory",
      description: "Stock levels and reorder points.",
      icon: "Package",
      columns: { create: toColumns(inventoryColumns) },
    },
  });

  const sheet = await prisma.spreadsheet.create({
    data: {
      workspaceId,
      templateId: purchaseTemplate.id,
      createdById: user.id,
      name: "Office Supplies — June",
      description: "Monthly purchasing for the office.",
      isFavorite: true,
      columns: toSnapshot(purchaseColumns),
    },
  });

  for (let i = 0; i < demoRows.length; i++) {
    const record = demoRows[i]!;
    const row = await prisma.row.create({
      data: { spreadsheetId: sheet.id, position: i, source: "MANUAL", createdById: user.id },
    });
    await prisma.cell.createMany({
      data: Object.entries(record)
        .filter(([, v]) => v !== "" && v != null)
        .map(([columnKey, value]) => ({ rowId: row.id, columnKey, value })),
    });
    await prisma.rowHistory.create({
      data: {
        spreadsheetId: sheet.id,
        rowId: row.id,
        actorId: user.id,
        changeType: "CREATE",
        snapshot: record,
        newValue: record,
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      workspaceId,
      actorId: user.id,
      action: "spreadsheet.create",
      entityType: "spreadsheet",
      entityId: sheet.id,
      metadata: { name: sheet.name },
    },
  });

  console.log("✅  Seed complete: 3 templates, 1 spreadsheet, 4 rows.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
