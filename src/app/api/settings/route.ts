import type { NextRequest } from "next/server";
import { getAuthContext } from "@/server/auth";
import { ok, route } from "@/server/http";
import { userSettingsSchema } from "@/lib/validations";
import { getSettings, updateSettings } from "@/server/services/settings-service";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const ctx = await getAuthContext();
  return ok(await getSettings(ctx));
});

export const PATCH = route(async (req: NextRequest) => {
  const ctx = await getAuthContext();
  const body = userSettingsSchema.parse(await req.json());
  return ok(await updateSettings(ctx, body));
});
