import type { NextRequest } from "next/server";
import { getAuthContext } from "@/server/auth";
import { paginated, parsePagination, route } from "@/server/http";
import { listAudit } from "@/server/services/audit-service";

export const dynamic = "force-dynamic";

export const GET = route(async (req: NextRequest) => {
  const ctx = await getAuthContext();
  const { searchParams } = new URL(req.url);
  const { skip, take, page, pageSize } = parsePagination(searchParams, { pageSize: 50 });
  const { items, total } = await listAudit(ctx.workspace.id, { skip, take });
  return paginated(items, total, page, pageSize);
});
