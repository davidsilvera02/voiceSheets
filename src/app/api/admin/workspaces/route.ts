import { getActor } from "@/server/auth";
import { ForbiddenError, ok, route } from "@/server/http";
import { listWorkspacesForAdmin } from "@/server/services/admin-service";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const actor = await getActor();
  if (!actor.isSuperAdmin) throw new ForbiddenError();
  return ok(await listWorkspacesForAdmin());
});
