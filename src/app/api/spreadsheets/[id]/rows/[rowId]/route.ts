import type { NextRequest } from "next/server";
import { getAuthContext } from "@/server/auth";
import { ok, route } from "@/server/http";
import { updateRowSchema } from "@/lib/validations";
import { deleteRow, updateRow } from "@/server/services/row-service";

export const dynamic = "force-dynamic";

type Params = { params: { id: string; rowId: string } };

export const PATCH = route(async (req: NextRequest, { params }: Params) => {
  const ctx = await getAuthContext();
  const body = updateRowSchema.parse(await req.json());
  return ok(await updateRow(ctx, params.id, params.rowId, body));
});

export const DELETE = route(async (_req: NextRequest, { params }: Params) => {
  const ctx = await getAuthContext();
  await deleteRow(ctx, params.id, params.rowId);
  return ok({ deleted: true });
});
