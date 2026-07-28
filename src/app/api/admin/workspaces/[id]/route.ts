import type { NextRequest } from "next/server";
import { getActor } from "@/server/auth";
import { ForbiddenError, ok, route } from "@/server/http";
import { deleteWorkspaceForAdmin } from "@/server/services/admin-service";

export const dynamic = "force-dynamic";

export const DELETE = route(
  async (_req: NextRequest, { params }: { params: { id: string } }) => {
    const actor = await getActor();
    if (!actor.isSuperAdmin) throw new ForbiddenError();
    await deleteWorkspaceForAdmin(params.id);
    return ok({ deleted: true });
  },
);
