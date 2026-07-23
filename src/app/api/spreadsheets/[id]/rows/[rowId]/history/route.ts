import type { NextRequest } from "next/server";
import { getAuthContext } from "@/server/auth";
import { ok, route } from "@/server/http";
import { requireSpreadsheet } from "@/server/services/spreadsheet-service";
import { listRowHistory } from "@/server/services/history-service";

export const dynamic = "force-dynamic";

export const GET = route(
  async (_req: NextRequest, { params }: { params: { id: string; rowId: string } }) => {
    const ctx = await getAuthContext();
    await requireSpreadsheet(ctx.workspace.id, params.id);
    return ok(await listRowHistory(params.rowId));
  },
);
