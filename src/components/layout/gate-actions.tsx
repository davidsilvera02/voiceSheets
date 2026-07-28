"use client";

import { SignOutButton } from "@clerk/nextjs";
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
