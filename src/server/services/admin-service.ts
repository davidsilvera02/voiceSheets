import "server-only";
import type { AccessStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

/** One row in the vendor admin panel — an organization/workspace. */
export interface AdminWorkspaceRow {
  id: string;
  name: string;
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

/** Every workspace, pending first, for the vendor admin panel. */
export async function listWorkspacesForAdmin(): Promise<AdminWorkspaceRow[]> {
  const workspaces = await prisma.workspace.findMany({
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
  });

  return workspaces.map((w) => ({
    id: w.id,
    name: w.name,
    clerkOrgId: w.clerkOrgId,
    accessStatus: w.accessStatus,
    activatedAt: w.activatedAt?.toISOString() ?? null,
    createdAt: w.createdAt.toISOString(),
    memberCount: w._count.memberships,
    spreadsheetCount: w._count.spreadsheets,
    templateCount: w._count.templates,
    ownerEmail: w.owner?.email ?? null,
    lastActivityAt: w.spreadsheets[0]?.lastActivityAt.toISOString() ?? null,
  }));
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
