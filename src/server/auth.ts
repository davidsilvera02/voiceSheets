import "server-only";
import type { AccessStatus, MembershipRole, User, Workspace } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env, isClerkConfigured, isSuperAdmin } from "@/lib/env";
import { slugify } from "@/lib/utils";
import { seedWorkspace } from "@/server/starter-templates";

export interface AuthContext {
  user: User;
  workspace: Workspace;
  role: MembershipRole;
  accessStatus: AccessStatus;
  /** True when the current user is a vendor super-admin (may reach /admin). */
  isSuperAdmin: boolean;
}

/** The current actor, resolved without requiring an organization/workspace. */
export interface Actor {
  user: User;
  isSuperAdmin: boolean;
}

const DEV_USER = {
  clerkId: null,
  email: "dev@voicesheets.local",
  name: "Dev User",
} as const;

interface Identity {
  clerkId: string | null;
  email: string;
  name?: string | null;
  imageUrl?: string | null;
  /** Active Clerk organization, when Clerk Organizations are in use. */
  orgId?: string | null;
  orgName?: string | null;
  orgRole?: string | null; // e.g. "org:admin"
  /** True for the local single-user dev identity (no Clerk). */
  isDev?: boolean;
}

/** Upsert the User row and compute whether they are a vendor super-admin. */
async function resolveActor(identity: Identity): Promise<Actor> {
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
  return { user, isSuperAdmin: isSuperAdmin(user.email) };
}

/** Map a Clerk organization role string to our membership role. */
function mapOrgRole(orgRole: string | null | undefined): MembershipRole {
  return (orgRole ?? "").includes("admin") ? "ADMIN" : "EDITOR";
}

/**
 * Ensure the current user has a workspace and membership, and return the fully
 * resolved auth context. When a Clerk organization is active the workspace is
 * shared across the whole org (keyed by clerkOrgId); otherwise a personal
 * dev workspace is used.
 */
async function resolveContext(identity: Identity): Promise<AuthContext> {
  const { user, isSuperAdmin: superAdmin } = await resolveActor(identity);

  // --- Organization-scoped workspace (shared) -----------------------------
  if (identity.orgId) {
    let workspace = await prisma.workspace.findUnique({
      where: { clerkOrgId: identity.orgId },
    });

    if (!workspace) {
      workspace = await prisma.workspace.create({
        data: {
          name: identity.orgName ?? "Organization",
          slug: `${slugify(identity.orgName ?? "org")}-${identity.orgId.slice(-6)}`,
          ownerId: user.id,
          clerkOrgId: identity.orgId,
          // New orgs are provisioned but gated until a super-admin activates.
          accessStatus: "PENDING",
        },
      });
      try {
        await seedWorkspace(prisma, workspace.id, user.id);
      } catch (error) {
        console.error("[voicesheets] Failed to seed workspace:", error);
      }
    }

    const role = mapOrgRole(identity.orgRole);
    await prisma.membership.upsert({
      where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
      update: { role },
      create: { userId: user.id, workspaceId: workspace.id, role },
    });

    await prisma.userSettings.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    });

    return {
      user,
      workspace,
      role,
      accessStatus: workspace.accessStatus,
      isSuperAdmin: superAdmin,
    };
  }

  // --- Clerk user with no active organization -----------------------------
  // Regular users must create or join an org. Super-admins (the vendor) are the
  // exception: they get a personal workspace so they have full access to the app
  // *and* the /admin panel without belonging to a customer org.
  if (!identity.isDev && !superAdmin) {
    throw new NoOrganizationError();
  }

  // --- Personal / dev workspace (always active) ---------------------------
  // Scoped to a personal (non-org) workspace so a super-admin who also belongs
  // to an org still lands on their own workspace here.
  let membership = await prisma.membership.findFirst({
    where: { userId: user.id, workspace: { clerkOrgId: null } },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) {
    const workspace = await prisma.workspace.create({
      data: {
        name: `${identity.name ?? "My"} Workspace`,
        slug: `${slugify(identity.name ?? "workspace")}-${user.id.slice(-6)}`,
        ownerId: user.id,
        accessStatus: "ACTIVE",
        activatedAt: new Date(),
        memberships: { create: { userId: user.id, role: "OWNER" } },
      },
    });
    try {
      await seedWorkspace(prisma, workspace.id, user.id);
    } catch (error) {
      console.error("[voicesheets] Failed to seed workspace:", error);
    }
    membership = await prisma.membership.findFirstOrThrow({
      where: { userId: user.id, workspaceId: workspace.id },
      include: { workspace: true },
    });
  }

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });

  return {
    user,
    workspace: membership.workspace,
    role: membership.role,
    accessStatus: membership.workspace.accessStatus,
    isSuperAdmin: superAdmin,
  };
}

/** Read the current Clerk identity (or the dev identity when Clerk is off). */
async function currentIdentity(): Promise<Identity> {
  if (isClerkConfigured()) {
    const { auth, clerkClient } = await import("@clerk/nextjs/server");
    const { userId, orgId, orgRole, orgSlug } = auth();
    if (!userId) throw new UnauthorizedError();
    const clerkUser = await clerkClient().users.getUser(userId);
    const email =
      clerkUser.primaryEmailAddress?.emailAddress ??
      clerkUser.emailAddresses[0]?.emailAddress ??
      `${userId}@clerk.local`;
    return {
      clerkId: userId,
      email,
      name:
        [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
        clerkUser.username ||
        null,
      imageUrl: clerkUser.imageUrl ?? null,
      orgId: orgId ?? null,
      orgName: orgSlug ?? null,
      orgRole: orgRole ?? null,
    };
  }
  return { ...DEV_USER, isDev: true };
}

/** Full workspace-scoped auth context. Used by the app and its API routes. */
export async function getAuthContext(): Promise<AuthContext> {
  return resolveContext(await currentIdentity());
}

/**
 * Resolve just the current user + super-admin flag, without requiring an
 * organization or workspace. Used by the admin panel and its API.
 */
export async function getActor(): Promise<Actor> {
  return resolveActor(await currentIdentity());
}

export class UnauthorizedError extends Error {
  constructor(message = "You must be signed in") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/** A signed-in Clerk user who is not a member of any active organization. */
export class NoOrganizationError extends Error {
  constructor(message = "You are not part of an organization yet") {
    super(message);
    this.name = "NoOrganizationError";
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
