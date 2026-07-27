"use client";

import { OrganizationSwitcher, SignOutButton } from "@clerk/nextjs";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Sign out — rendered on every access-gate screen so a signed-in user without
 * an active organization is never trapped.
 */
export function GateSignOut() {
  return (
    <SignOutButton redirectUrl="/sign-in">
      <Button variant="outline" size="sm">
        <LogOut className="h-4 w-4" /> Sign out
      </Button>
    </SignOutButton>
  );
}

/**
 * Create a new organization, or select one you've been invited to. Selecting or
 * creating one makes it the active org, which unblocks the app. Requires
 * Organizations to be enabled in the Clerk dashboard.
 */
export function OrgPicker() {
  return (
    <OrganizationSwitcher
      hidePersonal
      afterCreateOrganizationUrl="/dashboard"
      afterSelectOrganizationUrl="/dashboard"
      appearance={{ elements: { rootBox: "flex justify-center" } }}
    />
  );
}
