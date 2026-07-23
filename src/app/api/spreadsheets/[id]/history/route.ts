import type { NextRequest } from "next/server";
import { getAuthContext } from "@/server/auth";
import { paginated, parsePagination, route } from "@/server/http";
import { requireSpreadsheet } from "@/server/services/spreadsheet-service";
import { listSpreadsheetHistory } from "@/server/services/history-service";

export const dynamic = "force-dynamic";

export const GET = route(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const ctx = await getAuthContext();
  await requireSpreadsheet(ctx.workspace.id, params.id);
  const { searchParams } = new URL(req.url);
  const { skip, take, page, pageSize } = parsePagination(searchParams, { pageSize: 50 });
  const { items, total } = await listSpreadsheetHistory(params.id, { skip, take });
  return paginated(items, total, page, pageSize);
});
