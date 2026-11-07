"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/primitives";
import { confirmPhoneAction, startPhoneVerificationAction } from "@/server/auth/actions";
import { useRouter } from "next/navigation";

export function PhoneVerify() {
  const [step, setStep] = React.useState<"idle" | "code">("idle");
  const [code, setCode] = React.useState("");
  const [pending, start] = React.useTransition();
  const router = useRouter();
  if (step === "idle")
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await startPhoneVerificationAction();
            if (!r.ok) return void toast.error(r.error);
            toast.info(r.message ?? "Code issued");
            if (r.data?.devCode) toast.message(`Development code: ${r.data.devCode}`, { duration: 20000 });
            setStep("code");
          })
        }
      >
        Verify
      </Button>
    );
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const fd = new FormData();
          fd.set("code", code);
          const r = await confirmPhoneAction(fd);
          if (r.ok) {
            toast.success("Phone verified");
            router.refresh();
          } else toast.error(r.error);
        });
      }}
    >
      <Input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} placeholder="6-digit code" className="h-8 w-28" aria-label="Verification code" />
      <Button size="sm" type="submit" disabled={pending || code.length !== 6}>
        Confirm
      </Button>
    </form>
  );
}
