import { NextResponse } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";

// Enable Clerk middleware only when Clerk is configured and dev-auth isn't
// forced; otherwise pass every request through untouched (single-user dev mode).
const clerkEnabled =
  process.env.VOICESHEETS_FORCE_DEV_AUTH !== "true" &&
  !!(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "").trim() &&
  !!(process.env.CLERK_SECRET_KEY ?? "").trim();

export default clerkEnabled ? clerkMiddleware() : () => NextResponse.next();

export const config = {
  matcher: [
    // Skip Next.js internals and static assets.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
