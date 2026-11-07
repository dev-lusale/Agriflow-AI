import type { Metadata } from "next";
import { ClipboardCheck, MapPinned, Route, Truck } from "lucide-react";
import { CtaBand, FeatureGrid, MarketingHero, Section } from "@/components/layout/marketing";
import { prisma } from "@/lib/db";
import { provinceLabel } from "@/lib/zambia";
import { Badge } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Logistics" };

export default async function LogisticsPage() {
  const transporters = await prisma.user
    .findMany({
      where: { role: "TRANSPORTER", status: "ACTIVE", transporterProfile: { isNot: null } },
      select: { id: true, verifiedAt: true, isDemo: true, transporterProfile: true, vehicles: { where: { isActive: true }, select: { capacityKg: true } } },
      take: 6,
    })
    .catch(() => []);
  return (
    <>
      <MarketingHero
        eyebrow="Logistics"
        title="Agricultural transport, coordinated"
        intro="Farmers and buyers request transport from inside an order. Transporters serving that province see the request, accept it, and update each step until proof of delivery."
        cta={{ href: "/auth/register?role=TRANSPORTER", label: "Register as a transporter" }}
      />
      <Section>
        <FeatureGrid
          cols={2}
          items={[
            { icon: Truck, title: "Jobs matched to your area", body: "Set your service provinces, vehicles and capacity. You only see requests you can serve." },
            { icon: ClipboardCheck, title: "Clear status for everyone", body: "Requested, accepted, pickup scheduled, picked up, in transit, delivered. The linked order updates automatically." },
            { icon: MapPinned, title: "Proof of delivery", body: "Record who received the goods, add notes and attach a photo." },
            { icon: Route, title: "Ready for maps", body: "Deliveries store optional pickup and drop-off coordinates and a tracking event log, ready for future mapping and route optimisation." },
          ]}
        />
      </Section>
      {transporters.length > 0 && (
        <Section title="Transporters on AgriFlow" muted>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {transporters.map((t) => (
              <div key={t.id} className="glass rounded-[1.75rem] p-5">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{t.transporterProfile!.businessName}</p>
                  {t.isDemo && <Badge tone="amber">Demo</Badge>}
                </div>
                <p className="mt-1 text-sm text-navy-500">{t.transporterProfile!.serviceProvinces.map(provinceLabel).join(", ")}</p>
                <p className="mt-2 text-xs text-navy-500">
                  {t.vehicles.length} vehicle(s) · up to {Math.max(0, ...t.vehicles.map((v) => v.capacityKg)).toLocaleString()} kg
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}
      <CtaBand title="Have trucks? Find agricultural loads." body="Register your transport business for free." href="/auth/register?role=TRANSPORTER" label="Register" />
    </>
  );
}
