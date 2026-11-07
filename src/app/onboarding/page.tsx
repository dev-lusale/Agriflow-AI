import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { Card } from "@/components/ui/primitives";
import { getCurrentUser } from "@/lib/auth/session";
import { ROLE_HOME, ROLE_LABEL, isAdminRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/db";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Complete your profile" };

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  if (isAdminRole(user.role)) redirect("/admin");
  const [crops, categories] = await Promise.all([
    prisma.crop.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { name: true } }),
    prisma.productCategory.findMany({ where: { isActive: true, kind: "INPUT" }, orderBy: { name: "asc" }, select: { name: true } }),
  ]);
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link href="/">
            <Logo />
          </Link>
          {user.onboardingCompletedAt && (
            <Link href={ROLE_HOME[user.role]} className="text-sm font-medium text-forest-700">
              Skip to dashboard
            </Link>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-forest-600">{ROLE_LABEL[user.role]} account</p>
        <h1 className="mt-1 text-2xl font-bold">Tell us about {user.role === "FARMER" ? "you and your farm" : "your business"}</h1>
        <p className="mt-1 text-sm text-navy-500">Only the essentials. You can add more detail later from your profile.</p>
        <Card className="mt-6 p-5 sm:p-6">
          <OnboardingForm
            role={user.role as "FARMER" | "BUYER" | "SUPPLIER" | "TRANSPORTER"}
            defaults={{ fullName: user.profile?.fullName ?? "", phone: user.phone ?? "", province: user.profile?.province ?? null, district: user.profile?.district ?? null }}
            crops={crops.map((c) => c.name)}
            categories={categories.map((c) => c.name)}
          />
        </Card>
      </main>
    </div>
  );
}
