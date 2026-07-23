import type { NextRequest } from "next/server";
import { getAuthContext } from "@/server/auth";
import { ok, paginated, parsePagination, route } from "@/server/http";
import { createRowSchema } from "@/lib/validations";
import { createRow, listRows } from "@/server/services/row-service";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export const GET = route(async (req: NextRequest, { params }: Params) => {
  const ctx = await getAuthContext();
  const { searchParams } = new URL(req.url);
  const paginate = searchParams.has("page") || searchParams.has("pageSize");
  const { skip, take, page, pageSize } = parsePagination(searchParams, { pageSize: 5000 });
  const { items, total } = await listRows(ctx.workspace.id, params.id, {
    search: searchParams.get("q") ?? undefined,
    skip: paginate ? skip : 0,
    take: paginate ? take : undefined,
  });
  return paginated(items, total, page, paginate ? pageSize : total || 1);
});

export const POST = route(async (req: NextRequest, { params }: Params) => {
  const ctx = await getAuthContext();
  const body = createRowSchema.parse(await req.json());
  return ok(
    await createRow(
      ctx,
      params.id,
      { values: body.values, source: body.source },
      body.meta,
    ),
    { status: 201 },
  );
});
