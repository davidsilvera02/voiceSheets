import type { NextRequest } from "next/server";
import { getAuthContext } from "@/server/auth";
import { ok, paginated, parsePagination, route } from "@/server/http";
import { createTemplateSchema } from "@/lib/validations";
import { createTemplate, listTemplates } from "@/server/services/template-service";

export const dynamic = "force-dynamic";

export const GET = route(async (req: NextRequest) => {
  const ctx = await getAuthContext();
  const { searchParams } = new URL(req.url);
  const { skip, take, page, pageSize } = parsePagination(searchParams);
  const status = searchParams.get("status") as "ACTIVE" | "ARCHIVED" | null;
  const { items, total } = await listTemplates(ctx.workspace.id, {
    status: status ?? undefined,
    search: searchParams.get("q") ?? undefined,
    skip,
    take,
  });
  return paginated(items, total, page, pageSize);
});

export const POST = route(async (req: NextRequest) => {
  const ctx = await getAuthContext();
  const body = createTemplateSchema.parse(await req.json());
  const template = await createTemplate(ctx, body);
  return ok(template, { status: 201 });
});
