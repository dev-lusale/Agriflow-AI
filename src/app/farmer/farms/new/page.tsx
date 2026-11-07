import type { Metadata } from "next";
import { Card } from "@/components/ui/primitives";
import { PageHeader } from "@/components/layout/page";
import { FarmForm } from "@/components/farm/forms";
import { requirePageRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Add farm" };

export default async function NewFarmPage() {
  const user = await requirePageRole("FARMER");
  return (
    <>
      <PageHeader title="Add a farm" back={{ href: "/farmer/farms", label: "Farms" }} description="You can add fields and crops after creating the farm." />
      <Card className="max-w-3xl p-5 sm:p-6">
        <FarmForm farm={{ province: user.profile?.province ?? undefined, district: user.profile?.district ?? undefined }} />
      </Card>
    </>
  );
}
