import type { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/server/auth";
import { ok, route } from "@/server/http";
import { restoreRowVersion } from "@/server/services/row-service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ historyId: z.string().min(1) });

export const POST = route(
  async (req: NextRequest, { params }: { params: { id: string; rowId: string } }) => {
    const ctx = await getAuthContext();
    const { historyId } = bodySchema.parse(await req.json());
    return ok(await restoreRowVersion(ctx, params.id, params.rowId, historyId));
  },
);
