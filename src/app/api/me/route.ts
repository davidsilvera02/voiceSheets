import { getAuthContext } from "@/server/auth";
import { isAnthropicConfigured, isClerkConfigured, isWhisperConfigured } from "@/lib/env";
import { ok, route } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const ctx = await getAuthContext();
  return ok({
    user: {
      id: ctx.user.id,
      email: ctx.user.email,
      name: ctx.user.name,
      imageUrl: ctx.user.imageUrl,
    },
    workspace: { id: ctx.workspace.id, name: ctx.workspace.name },
    role: ctx.role,
    capabilities: {
      clerk: isClerkConfigured(),
      anthropic: isAnthropicConfigured(),
      whisper: isWhisperConfigured(),
    },
  });
});
