"use client";

import { use } from "react";
import Link from "next/link";
import { ActionForm, SubmitButton, TextField } from "@/components/forms/action-form";
import { Alert } from "@/components/ui/primitives";
import { resetPasswordAction } from "@/server/auth/actions";

export default function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = use(searchParams);
  if (!token) {
    return (
      <Alert tone="red" title="Missing reset token">
        Open the link from your email again, or{" "}
        <Link href="/auth/forgot-password" className="underline">
          request a new one
        </Link>
        .
      </Alert>
    );
  }
  return (
    <div>
      <h1 className="text-2xl font-bold">Choose a new password</h1>
      <p className="mt-1 text-sm text-navy-500">For security, you&apos;ll be signed out of all other devices.</p>
      <ActionForm action={resetPasswordAction} className="mt-6 space-y-4" refresh={false}>
        <input type="hidden" name="token" value={token} />
        <TextField name="password" label="New password" type="password" autoComplete="new-password" required hint="At least 8 characters, with letters and numbers." />
        <TextField name="confirm" label="Confirm password" type="password" autoComplete="new-password" required />
        <SubmitButton className="w-full" size="lg">
          Update password
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
