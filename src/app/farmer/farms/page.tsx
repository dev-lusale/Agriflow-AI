import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Plus, Tractor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/primitives";
import { EmptyState, PageHeader } from "@/components/layout/page";
import { requirePageRole } from "@/lib/auth/session";
import { provinceLabel } from "@/lib/zambia";
import { formatNumber, titleCase } from "@/lib/utils";
import { listFarms } from "@/server/farms/service";

export const metadata: Metadata = { title: "My farms" };

export default async function FarmsPage() {
  const user = await requirePageRole("FARMER");
  const farms = await listFarms({ id: user.id, role: user.role });
  return (
    <>
      <PageHeader
        title="Farms"
        description="Register each farm you manage. Divide farms into fields to track crops and costs precisely."
        actions={
          <Button asChild>
            <Link href="/farmer/farms/new">
              <Plus /> Add farm
            </Link>
          </Button>
        }
      />
      {farms.length === 0 ? (
        <EmptyState icon={Tractor} title="No farms yet" description="Add your first farm to get started." action={<Button asChild><Link href="/farmer/farms/new">Add farm</Link></Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {farms.map((f) => (
            <Link key={f.id} href={`/farmer/farms/${f.id}`}>
              <Card className="h-full overflow-hidden transition hover:shadow-[var(--shadow-lift)]">
                <div className="relative h-28 bg-gradient-to-br from-forest-700 to-forest-900">
                  {f.photoId ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/uploads/${f.photoId}`} alt="" className="size-full object-cover opacity-90" />
                  ) : (
                    <svg className="absolute inset-0 size-full opacity-25" viewBox="0 0 300 110" preserveAspectRatio="none" aria-hidden="true">
                      {Array.from({ length: 14 }).map((_, i) => (
                        <path key={i} d={`M${i * 24 - 40} 110 Q${i * 24 + 10} 55 ${i * 24 + 60} 0`} stroke="#86efac" strokeWidth="1.5" fill="none" />
                      ))}
                    </svg>
                  )}
                  <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                    <p className="text-lg font-bold text-white drop-shadow">{f.name}</p>
                    <Badge tone="green" className="bg-white/90">{titleCase(f.farmingType)}</Badge>
                  </div>
                </div>
                <div className="space-y-3 p-4">
                  <p className="flex items-center gap-1 text-sm text-navy-600">
                    <MapPin className="size-4 text-navy-400" />
                    {f.district}, {provinceLabel(f.province)}
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-navy-50 p-2">
                      <p className="text-sm font-bold">{formatNumber(f.size.toString())}</p>
                      <p className="text-[11px] text-navy-500">{f.sizeUnit.toLowerCase()}</p>
                    </div>
                    <div className="rounded-lg bg-navy-50 p-2">
                      <p className="text-sm font-bold">{f._count.fields}</p>
                      <p className="text-[11px] text-navy-500">fields</p>
                    </div>
                    <div className="rounded-lg bg-navy-50 p-2">
                      <p className="text-sm font-bold">{f._count.cropRecords}</p>
                      <p className="text-[11px] text-navy-500">crop records</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {f.cropRecords.map((c) => (
                      <Badge key={c.id} tone={c.status === "GROWING" ? "blue" : "amber"}>
                        {c.crop.name} · {titleCase(c.status)}
                      </Badge>
                    ))}
                    {f.latitude === null && <Badge tone="slate">No GPS</Badge>}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
