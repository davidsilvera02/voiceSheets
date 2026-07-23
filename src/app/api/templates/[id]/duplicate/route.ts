import type { NextRequest } from "next/server";
import { getAuthContext } from "@/server/auth";
import { ok, route } from "@/server/http";
import { duplicateTemplate } from "@/server/services/template-service";

export const dynamic = "force-dynamic";

export const POST = route(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  const ctx = await getAuthContext();
  return ok(await duplicateTemplate(ctx, params.id), { status: 201 });
});
