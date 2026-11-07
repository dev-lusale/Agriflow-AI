import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/primitives";
import { getCurrentUser } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/auth/roles";
import { env } from "@/lib/env";
import { DemoLogin, LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string; signedOut?: string; verified?: string }> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(ROLE_HOME[user.role]);
  return (
    <div>
      <h1 className="text-2xl font-bold">Welcome back</h1>
      <p className="mt-1 text-sm text-navy-500">Sign in to your AgriFlow AI account.</p>
      <div className="mt-6 space-y-3">
        {sp.reset && <Alert tone="green" title="Password updated">Sign in with your new password.</Alert>}
        {sp.signedOut && <Alert tone="slate">You have been signed out.</Alert>}
        {sp.verified && <Alert tone="green" title="Email verified">Thank you. Your email address is confirmed.</Alert>}
      </div>
      <LoginForm next={sp.next} />
      <p className="mt-6 text-center text-sm text-navy-600">
        New to AgriFlow?{" "}
        <Link href="/auth/register" className="font-semibold text-forest-700 hover:underline">
          Create an account
        </Link>
      </p>
      {env.demoMode && <DemoLogin />}
    </div>
  );
}
