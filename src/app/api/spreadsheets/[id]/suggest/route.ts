import type { NextRequest } from "next/server";
import { getAuthContext } from "@/server/auth";
import { ok, route, ValidationError } from "@/server/http";
import { suggestValues } from "@/server/services/stats-service";

export const dynamic = "force-dynamic";

export const GET = route(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const ctx = await getAuthContext();
  const { searchParams } = new URL(req.url);
  const column = searchParams.get("column");
  if (!column) throw new ValidationError("A `column` query parameter is required");
  const suggestions = await suggestValues(
    ctx.workspace.id,
    params.id,
    column,
    searchParams.get("q") ?? "",
  );
  return ok(suggestions);
});
