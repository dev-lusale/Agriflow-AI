import Link from "next/link";
import { Alert } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { verifyEmail } from "@/server/auth/service";
import { AppError } from "@/lib/errors";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  let ok = false;
  let message = "This verification link is missing a token.";
  if (token) {
    try {
      await verifyEmail(token);
      ok = true;
    } catch (e) {
      message = e instanceof AppError ? e.message : "Verification failed.";
    }
  }
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Email verification</h1>
      {ok ? <Alert tone="green" title="Your email is verified">Thank you for confirming your address.</Alert> : <Alert tone="red" title="Could not verify">{message}</Alert>}
      <Button asChild className="w-full">
        <Link href="/auth/login?verified=1">Continue</Link>
      </Button>
    </div>
  );
}
