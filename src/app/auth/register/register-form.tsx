"use client";

import * as React from "react";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, ShoppingCart, Sprout, Store, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/primitives";
import { registerSchema, type RegisterInput } from "@/lib/validation/schemas";
import { registerAction } from "@/server/auth/actions";
import { cn } from "@/lib/utils";

const ROLES = [
  { value: "FARMER", label: "Farmer", desc: "Manage farms, get AI advice, sell produce", icon: Sprout },
  { value: "BUYER", label: "Buyer", desc: "Source produce from farmers", icon: ShoppingCart },
  { value: "SUPPLIER", label: "Input supplier", desc: "Sell seed, fertilizer, equipment", icon: Store },
  { value: "TRANSPORTER", label: "Transporter", desc: "Deliver agricultural goods", icon: Truck },
] as const;

/** Registration uses React Hook Form + Zod on the client; the server action re-validates everything. */
export function RegisterForm({ defaultRole }: { defaultRole: string }) {
  const [pending, start] = React.useTransition();
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: defaultRole as RegisterInput["role"], fullName: "", email: "", password: "", phone: undefined, consent: undefined },
  });
  const role = useWatch({ control: form.control, name: "role" });
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit((values) => {
    const fd = new FormData();
    Object.entries(values).forEach(([k, v]) => v !== undefined && v !== "" && fd.set(k, String(v === true ? "on" : v)));
    start(async () => {
      const res = await registerAction(fd);
      if (res && !res.ok) {
        toast.error(res.error);
        Object.entries(res.fieldErrors ?? {}).forEach(([k, v]) => v?.[0] && form.setError(k as keyof RegisterInput, { message: v[0] }));
      }
    });
  });

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-navy-700">I am a…</legend>
        <div className="grid grid-cols-2 gap-2">
          {ROLES.map((r) => (
            <label key={r.value} className={cn("cursor-pointer rounded-xl border p-3 transition-colors", role === r.value ? "border-forest-500 bg-forest-50 ring-1 ring-forest-500" : "border-border hover:border-navy-300")}>
              <input type="radio" value={r.value} className="sr-only" {...form.register("role")} />
              <r.icon className={cn("size-5", role === r.value ? "text-forest-700" : "text-navy-400")} />
              <p className="mt-2 text-sm font-semibold">{r.label}</p>
              <p className="text-xs text-navy-500">{r.desc}</p>
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Full name" htmlFor="fullName" error={errors.fullName?.message} required>
        <Input id="fullName" autoComplete="name" aria-invalid={!!errors.fullName} {...form.register("fullName")} />
      </Field>
      <Field label="Email" htmlFor="email" error={errors.email?.message} required>
        <Input id="email" type="email" autoComplete="email" inputMode="email" aria-invalid={!!errors.email} {...form.register("email")} />
      </Field>
      <Field label="Phone number" htmlFor="phone" error={errors.phone?.message} hint="Optional. Used for future SMS alerts and phone verification.">
        <Input id="phone" type="tel" placeholder="+260 97 1234567" autoComplete="tel" {...form.register("phone", { setValueAs: (v) => (v ? v : undefined) })} />
      </Field>
      <Field label="Password" htmlFor="password" error={errors.password?.message} hint="At least 8 characters, with letters and numbers." required>
        <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...form.register("password")} />
      </Field>
      <div>
        <label className="flex items-start gap-2.5 text-sm text-navy-700">
          <input type="checkbox" className="mt-0.5 size-4 accent-forest-700" {...form.register("consent", { setValueAs: (v) => (v ? "on" : undefined) })} />
          <span>
            I agree to the{" "}
            <Link href="/terms" className="font-medium text-forest-700 underline" target="_blank">
              terms of use
            </Link>{" "}
            and consent to my data being processed as described in the{" "}
            <Link href="/privacy" className="font-medium text-forest-700 underline" target="_blank">
              privacy notice
            </Link>
            .
          </span>
        </label>
        {errors.consent?.message && <p className="mt-1 text-xs font-medium text-red-600">{errors.consent.message}</p>}
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Create account
      </Button>
    </form>
  );
}
