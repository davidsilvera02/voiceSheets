import type { NextRequest } from "next/server";
import { getAuthContext } from "@/server/auth";
import { ok, route } from "@/server/http";
import { bulkDeleteRowsSchema, bulkUpdateRowsSchema } from "@/lib/validations";
import { bulkDeleteRows, bulkUpdateRows } from "@/server/services/row-service";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export const PATCH = route(async (req: NextRequest, { params }: Params) => {
  const ctx = await getAuthContext();
  const body = bulkUpdateRowsSchema.parse(await req.json());
  return ok(await bulkUpdateRows(ctx, params.id, body.rowIds, body.values));
});

export const DELETE = route(async (req: NextRequest, { params }: Params) => {
  const ctx = await getAuthContext();
  const body = bulkDeleteRowsSchema.parse(await req.json());
  return ok(await bulkDeleteRows(ctx, params.id, body.rowIds));
});
