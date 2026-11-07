import { BadgeCheck, Mail, Phone, ShieldCheck } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { KeyValue, PageHeader } from "@/components/layout/page";
import { ActionButton } from "@/components/forms/action-form";
import { OnboardingForm } from "@/app/onboarding/onboarding-form";
import { PhoneVerify } from "./phone-verify";
import { prisma } from "@/lib/db";
import { ROLE_LABEL } from "@/lib/auth/roles";
import { provinceLabel } from "@/lib/zambia";
import { formatDate } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth/session";
import { resendVerificationAction } from "@/server/auth/actions";

export async function ProfileView({ user }: { user: SessionUser }) {
  const [full, crops, categories] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { createdAt: true, farmerProfile: true, buyerProfile: true, supplierProfile: true, transporterProfile: true } }),
    prisma.crop.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { name: true } }),
    prisma.productCategory.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { name: true } }),
  ]);
  const biz = full.supplierProfile?.businessName ?? full.transporterProfile?.businessName ?? full.buyerProfile?.businessName;
  return (
    <>
      <PageHeader title="Profile" description="Your account details and verification status." />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {user.profile?.fullName}
                {user.verifiedAt && (
                  <Badge tone="green">
                    <BadgeCheck className="size-3.5" /> Verified by AgriFlow
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <KeyValue
                className="sm:grid-cols-1"
                items={[
                  ["Account type", ROLE_LABEL[user.role]],
                  ["Business", biz ?? "—"],
                  ["Location", user.profile?.district ? `${user.profile.district}, ${provinceLabel(user.profile.province)}` : "—"],
                  ["Member since", formatDate(full.createdAt)],
                  ["Data-processing consent", user.dataConsentAt ? `Given ${formatDate(user.dataConsentAt)}` : "Not recorded"],
                ]}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-forest-600" /> Verification
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="size-4 text-navy-400" />
                  <span>{user.email}</span>
                </div>
                {user.emailVerifiedAt ? (
                  <Badge tone="green">Verified</Badge>
                ) : (
                  <ActionButton size="sm" variant="outline" action={resendVerificationAction}>
                    Send link
                  </ActionButton>
                )}
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="size-4 text-navy-400" />
                  <span>{user.phone ?? "No phone number"}</span>
                </div>
                {user.phoneVerifiedAt ? <Badge tone="green">Verified</Badge> : user.phone ? <PhoneVerify /> : <Badge>Add below</Badge>}
              </div>
              <p className="text-xs text-navy-500">Phone verification uses one-time codes. SMS delivery is not connected in this build, so codes are recorded in the outbox (and shown on screen in development).</p>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Edit profile</CardTitle>
          </CardHeader>
          <CardContent>
            {user.role !== "ADMIN" && user.role !== "SUPER_ADMIN" ? (
              <OnboardingForm role={user.role} defaults={{ fullName: user.profile?.fullName ?? "", phone: user.phone ?? "", province: user.profile?.province ?? null, district: user.profile?.district ?? null }} crops={crops.map((c) => c.name)} categories={categories.map((c) => c.name)} />
            ) : (
              <p className="text-sm text-navy-500">Administrator profiles are managed by a super administrator.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
