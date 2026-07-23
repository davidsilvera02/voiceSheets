import { redirect } from "next/navigation";
import { SignUp } from "@clerk/nextjs";
import { isClerkConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function SignUpPage() {
  if (!isClerkConfigured()) redirect("/dashboard");
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <SignUp />
    </div>
  );
}
