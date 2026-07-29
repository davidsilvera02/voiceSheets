import "server-only";
import type { AccessStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isClerkConfigured } from "@/lib/env";

/** One row in the vendor admin panel — an organization. */
export interface AdminWorkspaceRow {
  id: string;
  name: string;
  imageUrl: string | null;
  clerkOrgId: string | null;
  accessStatus: AccessStatus;
  activatedAt: string | null;
  createdAt: string;
  memberCount: number;
  spreadsheetCount: number;
  templateCount: number;
  ownerEmail: string | null;
  lastActivityAt: string | null;
}

/** Live name/image for each Clerk organization, keyed by org id. */
async function fetchClerkOrgs(): Promise<Map<string, { name: string; imageUrl: string | null }>> {
  const map = new Map<string, { name: string; imageUrl: string | null }>();
  if (!isClerkConfigured()) return map;
  const { clerkClient } = await import("@clerk/nextjs/server");
  try {
    const res = await clerkClient().organizations.getOrganizationList({ limit: 500 });
    for (const org of res.data) {
      map.set(org.id, { name: org.name, imageUrl: org.hasImage ? org.imageUrl : null });
    }
  } catch (error) {
    console.error("[voicesheets] Failed to list Clerk organizations:", error);
  }
  return map;
}

/**
 * Organizations for the vendor admin panel. Clerk is the source of truth for org
 * identity: each row's name and image come live from Clerk, and an org deleted
 * in Clerk drops out of the list (its orphaned workspace is pruned). Personal
 * (non-org) workspaces are excluded — the panel is only for organizations.
 */
export async function listWorkspacesForAdmin(): Promise<AdminWorkspaceRow[]> {
  const [workspaces, clerkOrgs] = await Promise.all([
    prisma.workspace.findMany({
      where: { clerkOrgId: { not: null } },
      orderBy: [{ accessStatus: "asc" }, { createdAt: "desc" }],
      include: {
        owner: { select: { email: true } },
        _count: { select: { memberships: true, spreadsheets: true, templates: true } },
        spreadsheets: {
          orderBy: { lastActivityAt: "desc" },
          take: 1,
          select: { lastActivityAt: true },
        },
      },
    }),
    fetchClerkOrgs(),
  ]);

  const clerkEnabled = isClerkConfigured();
  const orphanIds: string[] = [];
  const rows: AdminWorkspaceRow[] = [];

  for (const w of workspaces) {
    const org = w.clerkOrgId ? clerkOrgs.get(w.clerkOrgId) : undefined;
    // With Clerk as the source of truth, a workspace whose org no longer exists
    // in Clerk was deleted there — drop it and prune the orphaned workspace.
    if (clerkEnabled && !org) {
      orphanIds.push(w.id);
      continue;
    }
    rows.push({
      id: w.id,
      name: org?.name ?? w.name,
      imageUrl: org?.imageUrl ?? null,
      clerkOrgId: w.clerkOrgId,
      accessStatus: w.accessStatus,
      activatedAt: w.activatedAt?.toISOString() ?? null,
      createdAt: w.createdAt.toISOString(),
      memberCount: w._count.memberships,
      spreadsheetCount: w._count.spreadsheets,
      templateCount: w._count.templates,
      ownerEmail: w.owner?.email ?? null,
      lastActivityAt: w.spreadsheets[0]?.lastActivityAt.toISOString() ?? null,
    });
  }

  if (orphanIds.length > 0) {
    try {
      await prisma.workspace.deleteMany({ where: { id: { in: orphanIds } } });
    } catch (error) {
      console.error("[voicesheets] Failed to prune orphaned workspaces:", error);
    }
  }

  return rows;
}

/** Grant, revoke, or reset an organization's access to the app. */
export async function setWorkspaceAccess(workspaceId: string, status: AccessStatus) {
  return prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      accessStatus: status,
      // Stamp the moment access was granted; leave prior stamp otherwise.
      activatedAt: status === "ACTIVE" ? new Date() : undefined,
    },
    select: { id: true, accessStatus: true, activatedAt: true },
  });
}
