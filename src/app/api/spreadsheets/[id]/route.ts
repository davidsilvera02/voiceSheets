import type { NextRequest } from "next/server";
import { getAuthContext } from "@/server/auth";
import { ok, route } from "@/server/http";
import { updateSpreadsheetSchema } from "@/lib/validations";
import {
  deleteSpreadsheet,
  getSpreadsheet,
  updateSpreadsheet,
} from "@/server/services/spreadsheet-service";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export const GET = route(async (_req: NextRequest, { params }: Params) => {
  const ctx = await getAuthContext();
  return ok(await getSpreadsheet(ctx.workspace.id, params.id));
});

export const PATCH = route(async (req: NextRequest, { params }: Params) => {
  const ctx = await getAuthContext();
  const body = updateSpreadsheetSchema.parse(await req.json());
  return ok(await updateSpreadsheet(ctx, params.id, body));
});

export const DELETE = route(async (_req: NextRequest, { params }: Params) => {
  const ctx = await getAuthContext();
  await deleteSpreadsheet(ctx, params.id);
  return ok({ deleted: true });
});
