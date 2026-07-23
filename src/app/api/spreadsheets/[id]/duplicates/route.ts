import type { NextRequest } from "next/server";
import { getAuthContext } from "@/server/auth";
import { ok, route } from "@/server/http";
import { findDuplicates } from "@/server/services/stats-service";

export const dynamic = "force-dynamic";

export const GET = route(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  const ctx = await getAuthContext();
  return ok(await findDuplicates(ctx.workspace.id, params.id));
});
