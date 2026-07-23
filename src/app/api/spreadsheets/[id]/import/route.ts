import type { NextRequest } from "next/server";
import { getAuthContext } from "@/server/auth";
import { ok, route } from "@/server/http";
import { importRowsSchema } from "@/lib/validations";
import { importRows } from "@/server/services/row-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = route(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const ctx = await getAuthContext();
  const body = importRowsSchema.parse(await req.json());
  const result = await importRows(ctx, params.id, body.rows);
  return ok(result);
});
