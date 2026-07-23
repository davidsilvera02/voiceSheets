import type { NextRequest } from "next/server";
import { getAuthContext } from "@/server/auth";
import { ok, route } from "@/server/http";
import { duplicateSpreadsheet } from "@/server/services/spreadsheet-service";

export const dynamic = "force-dynamic";

export const POST = route(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const ctx = await getAuthContext();
  const body = await req.json().catch(() => ({}));
  const withRows = Boolean(body?.withRows);
  return ok(await duplicateSpreadsheet(ctx, params.id, withRows), { status: 201 });
});
