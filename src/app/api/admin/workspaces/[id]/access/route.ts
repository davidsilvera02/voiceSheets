import type { NextRequest } from "next/server";
import { z } from "zod";
import { getActor } from "@/server/auth";
import { ForbiddenError, ok, route } from "@/server/http";
import { setWorkspaceAccess } from "@/server/services/admin-service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  status: z.enum(["PENDING", "ACTIVE", "SUSPENDED"]),
});

export const POST = route(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const actor = await getActor();
    if (!actor.isSuperAdmin) throw new ForbiddenError();
    const { status } = bodySchema.parse(await req.json());
    const updated = await setWorkspaceAccess(params.id, status);
    return ok(updated);
  },
);
