import type { NextRequest } from "next/server";
import { getAuthContext } from "@/server/auth";
import { ok, route } from "@/server/http";
import { updateTemplateSchema } from "@/lib/validations";
import { deleteTemplate, getTemplate, updateTemplate } from "@/server/services/template-service";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export const GET = route(async (_req: NextRequest, { params }: Params) => {
  const ctx = await getAuthContext();
  return ok(await getTemplate(ctx.workspace.id, params.id));
});

export const PATCH = route(async (req: NextRequest, { params }: Params) => {
  const ctx = await getAuthContext();
  const body = updateTemplateSchema.parse(await req.json());
  return ok(await updateTemplate(ctx, params.id, body));
});

export const DELETE = route(async (_req: NextRequest, { params }: Params) => {
  const ctx = await getAuthContext();
  await deleteTemplate(ctx, params.id);
  return ok({ deleted: true });
});
