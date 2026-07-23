import "server-only";
import type { MembershipRole, User, Workspace } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env, isClerkConfigured } from "@/lib/env";
import { slugify } from "@/lib/utils";
import { createStarterTemplates } from "@/server/starter-templates";

export interface AuthContext {
  user: User;
  workspace: Workspace;
  role: MembershipRole;
}

const DEV_USER = {
  clerkId: null,
  email: "dev@voicesheets.local",
  name: "Dev User",
} as const;

/**
 * Ensure a User exists (found by clerkId or email), that they own a personal
 * workspace with a membership, and that a UserSettings row exists. Returns the
 * fully-resolved auth context. This is the single entry point every API route
 * and server component uses to identify the current actor.
 */
async function resolveContext(identity: {
  clerkId: string | null;
  email: string;
  name?: string | null;
  imageUrl?: string | null;
}): Promise<AuthContext> {
  const user = await prisma.user.upsert({
    where: identity.clerkId
      ? { clerkId: identity.clerkId }
      : { email: identity.email },
    update: {
      email: identity.email,
      name: identity.name ?? undefined,
      imageUrl: identity.imageUrl ?? undefined,
    },
    create: {
      clerkId: identity.clerkId,
      email: identity.email,
      name: identity.name ?? null,
      imageUrl: identity.imageUrl ?? null,
      settings: { create: {} },
    },
  });

  // Find (or lazily create) the user's personal workspace.
  let membership = await prisma.membership.findFirst({
    where: { userId: user.id },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) {
    const workspace = await prisma.workspace.create({
      data: {
        name: `${identity.name ?? "My"} Workspace`,
        slug: `${slugify(identity.name ?? "workspace")}-${user.id.slice(-6)}`,
        ownerId: user.id,
        memberships: { create: { userId: user.id, role: "OWNER" } },
      },
    });
    // Seed a brand-new workspace with a couple of ready-to-use templates.
    try {
      await createStarterTemplates(prisma, workspace.id, user.id);
    } catch (error) {
      console.error("[voicesheets] Failed to create starter templates:", error);
    }
    membership = await prisma.membership.findFirstOrThrow({
      where: { userId: user.id, workspaceId: workspace.id },
      include: { workspace: true },
    });
  }

  // Guarantee settings exist for users created before this column.
  await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });

  return { user, workspace: membership.workspace, role: membership.role };
}

/**
 * Resolve the current authenticated actor. Uses Clerk when configured,
 * otherwise falls back to a stable single-user dev identity so the app is fully
 * functional without any third-party auth account.
 */
export async function getAuthContext(): Promise<AuthContext> {
  if (isClerkConfigured()) {
    // Imported lazily so the Clerk runtime is only touched when configured.
    const { auth, clerkClient } = await import("@clerk/nextjs/server");
    const { userId } = auth();
    if (!userId) throw new UnauthorizedError();
    const clerkUser = await clerkClient().users.getUser(userId);
    const email =
      clerkUser.primaryEmailAddress?.emailAddress ??
      clerkUser.emailAddresses[0]?.emailAddress ??
      `${userId}@clerk.local`;
    return resolveContext({
      clerkId: userId,
      email,
      name:
        [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
        clerkUser.username ||
        null,
      imageUrl: clerkUser.imageUrl ?? null,
    });
  }

  return resolveContext({ ...DEV_USER });
}

export class UnauthorizedError extends Error {
  constructor(message = "You must be signed in") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export const authMode = {
  get clerk() {
    return isClerkConfigured();
  },
  get forceDev() {
    return env.FORCE_DEV_AUTH;
  },
};
