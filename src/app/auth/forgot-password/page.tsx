"use client";

import Link from "next/link";
import { ActionForm, SubmitButton, TextField } from "@/components/forms/action-form";
import { forgotPasswordAction } from "@/server/auth/actions";

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Reset your password</h1>
      <p className="mt-1 text-sm text-navy-500">Enter your account email. If it exists, we&apos;ll issue a secure reset link that expires in one hour.</p>
      <ActionForm action={forgotPasswordAction} className="mt-6 space-y-4" refresh={false} resetOnSuccess>
        <TextField name="email" label="Email" type="email" autoComplete="email" required />
        <SubmitButton className="w-full" size="lg">
          Send reset link
        </SubmitButton>
      </ActionForm>
      <p className="mt-4 rounded-xl bg-navy-50 p-3 text-xs text-navy-500">
        If email delivery is not configured on this server, the link is recorded in the outbox and the server log instead of being sent.
      </p>
      <p className="mt-6 text-center text-sm">
        <Link href="/auth/login" className="font-semibold text-forest-700 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
