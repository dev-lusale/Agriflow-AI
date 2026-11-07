"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShoppingCart, Sprout, Store, Truck } from "lucide-react";
import { ActionForm, SubmitButton, TextField } from "@/components/forms/action-form";
import { demoLoginAction, loginAction } from "@/server/auth/actions";
import { clearOfflineData } from "@/lib/offline/queue";

export function LoginForm({ next }: { next?: string }) {
  return (
    <ActionForm action={loginAction} className="mt-6 space-y-4" refresh={false}>
      <input type="hidden" name="next" value={next ?? ""} />
      <TextField name="email" label="Email" type="email" autoComplete="email" required inputMode="email" />
      <div>
        <TextField name="password" label="Password" type="password" autoComplete="current-password" required />
        <Link href="/auth/forgot-password" className="mt-1.5 inline-block text-xs font-medium text-forest-700 hover:underline">
          Forgot password?
        </Link>
      </div>
      <SubmitButton className="w-full" size="lg">
        Sign in
      </SubmitButton>
    </ActionForm>
  );
}

const DEMOS = [
  { role: "FARMER", label: "Farmer", icon: Sprout },
  { role: "BUYER", label: "Buyer", icon: ShoppingCart },
  { role: "SUPPLIER", label: "Supplier", icon: Store },
  { role: "TRANSPORTER", label: "Transporter", icon: Truck },
  { role: "ADMIN", label: "Admin", icon: ShieldCheck },
];

export function DemoLogin() {
  const [pending, start] = useTransition();
  return (
    <div className="mt-8 rounded-2xl border border-harvest-200 bg-harvest-50 p-4">
      <p className="text-sm font-semibold text-harvest-800">Demo mode: explore with fictional accounts</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {DEMOS.map((d) => (
          <button
            key={d.role}
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await clearOfflineData();
                const fd = new FormData();
                fd.set("role", d.role);
                const res = await demoLoginAction(fd);
                if (res && !res.ok) toast.error(res.error);
              })
            }
            className="flex items-center gap-2 rounded-xl border border-harvest-200 bg-white px-3 py-2 text-sm font-medium text-navy-800 hover:border-forest-300 hover:bg-forest-50 disabled:opacity-60"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <d.icon className="size-4 text-forest-700" />}
            {d.label}
          </button>
        ))}
      </div>
    </div>
  );
}
