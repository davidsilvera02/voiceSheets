import type { NextRequest } from "next/server";
import { getAuthContext } from "@/server/auth";
import { ok, paginated, parsePagination, route } from "@/server/http";
import { createSpreadsheetSchema } from "@/lib/validations";
import { createSpreadsheet, listSpreadsheets } from "@/server/services/spreadsheet-service";

export const dynamic = "force-dynamic";

export const GET = route(async (req: NextRequest) => {
  const ctx = await getAuthContext();
  const { searchParams } = new URL(req.url);
  const { skip, take, page, pageSize } = parsePagination(searchParams);
  const status = searchParams.get("status") as "ACTIVE" | "ARCHIVED" | null;
  const { items, total } = await listSpreadsheets(ctx.workspace.id, {
    status: status ?? undefined,
    favorite: searchParams.get("favorite") === "true" ? true : undefined,
    templateId: searchParams.get("templateId") ?? undefined,
    search: searchParams.get("q") ?? undefined,
    skip,
    take,
  });
  return paginated(items, total, page, pageSize);
});

export const POST = route(async (req: NextRequest) => {
  const ctx = await getAuthContext();
  const body = createSpreadsheetSchema.parse(await req.json());
  return ok(await createSpreadsheet(ctx, body), { status: 201 });
});
