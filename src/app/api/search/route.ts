import type { NextRequest } from "next/server";
import { getAuthContext } from "@/server/auth";
import { ok, route } from "@/server/http";
import { globalSearch } from "@/server/services/search-service";

export const dynamic = "force-dynamic";

export const GET = route(async (req: NextRequest) => {
  const ctx = await getAuthContext();
  const { searchParams } = new URL(req.url);
  const results = await globalSearch(ctx.workspace.id, searchParams.get("q") ?? "");
  return ok(results);
});
