import { redirect } from "next/navigation";
import { SignIn } from "@clerk/nextjs";
import { isClerkConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  if (!isClerkConfigured()) redirect("/dashboard");
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <SignIn />
    </div>
  );
}
