import type { NextRequest } from "next/server";
import { getAuthContext } from "@/server/auth";
import { ok, route } from "@/server/http";
import { aiCleanupSchema } from "@/lib/validations";
import { requireSpreadsheet } from "@/server/services/spreadsheet-service";
import { cleanupRows } from "@/server/services/ai-service";
import { bulkUpdateRows, listRows } from "@/server/services/row-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = route(async (req: NextRequest) => {
  const ctx = await getAuthContext();
  const body = aiCleanupSchema.parse(await req.json());
  const { columns } = await requireSpreadsheet(ctx.workspace.id, body.spreadsheetId);

  const { items } = await listRows(ctx.workspace.id, body.spreadsheetId);
  const target = items.filter((r) => body.rowIds.includes(r.id));

  const cleaned = await cleanupRows({
    columns,
    rows: target.map((r) => ({ id: r.id, values: r.values })),
  });

  // Apply each cleaned row individually (values differ per row).
  let updated = 0;
  for (const row of cleaned) {
    await bulkUpdateRows(ctx, body.spreadsheetId, [row.id], row.values);
    updated++;
  }

  return ok({ updated });
});
