import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Package, ShieldAlert } from "lucide-react";
import { MarketingHero, Section, CtaBand } from "@/components/layout/marketing";
import { Badge } from "@/components/ui/primitives";
import { prisma } from "@/lib/db";
import { formatZMW } from "@/lib/money";
import { UNIT_LABEL } from "@/lib/labels";
import { provinceLabel } from "@/lib/zambia";
import { browseProducts, listSuppliers } from "@/server/suppliers/service";

export const metadata: Metadata = { title: "Input suppliers" };

export default async function SuppliersPublicPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const [suppliers, products, categories] = await Promise.all([
    listSuppliers().catch(() => []),
    browseProducts({ category }).catch(() => []),
    prisma.productCategory.findMany({ where: { isActive: true, kind: "INPUT" }, orderBy: { name: "asc" } }).catch(() => []),
  ]);
  return (
    <>
      <MarketingHero
        eyebrow="Agricultural input supply"
        title="Seed, fertilizer and equipment from suppliers you can compare"
        intro="Suppliers list certified seed, fertilizer, crop protection, irrigation and tools with live stock levels. Farmers compare and order inside AgriFlow, and completed purchases post to their farm books and inventory."
        cta={{ href: "/auth/register?role=SUPPLIER", label: "Register as a supplier" }}
      />
      <Section title="Suppliers">
        {suppliers.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {suppliers.map((s) => (
              <div key={s.id} className="glass rounded-[1.75rem] p-5 shadow-[var(--shadow-card)]">
                <p className="flex items-center gap-1.5 font-semibold">
                  {s.supplierProfile?.businessName}
                  {s.verifiedAt && <BadgeCheck className="size-4 text-forest-600" aria-label="Verified" />}
                </p>
                <p className="text-sm text-navy-500">
                  {s.profile?.district}, {provinceLabel(s.profile?.province)}
                </p>
                <p className="mt-2 line-clamp-2 text-sm text-navy-600">{s.supplierProfile?.description}</p>
                <p className="mt-3 text-xs font-medium text-forest-700">{s._count.supplierProducts} active products</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-navy-500">No suppliers yet.</p>
        )}
      </Section>
      <Section title="Product catalogue" muted>
        <div className="mb-5 flex flex-wrap gap-2">
          <Link href="/suppliers" className={`rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition-colors ${!category ? "bg-ink text-white ring-ink shadow-sm" : "bg-white/80 text-navy-700 ring-black/5 hover:bg-white"}`}>
            All
          </Link>
          {categories.map((c) => (
            <Link key={c.id} href={`/suppliers?category=${c.slug}`} className={`rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition-colors ${category === c.slug ? "bg-ink text-white ring-ink shadow-sm" : "bg-white/80 text-navy-700 ring-black/5 hover:bg-white"}`}>
              {c.name}
            </Link>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.slice(0, 24).map((p) => (
            <div key={p.id} className="flex flex-col glass rounded-[1.75rem] p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex size-10 items-center justify-center rounded-xl bg-forest-50 text-forest-700">
                  <Package className="size-5" />
                </div>
                <div className="flex flex-wrap justify-end gap-1">
                  <Badge>{p.category.name}</Badge>
                  {p.isDemo && <Badge tone="amber">Demo</Badge>}
                </div>
              </div>
              <p className="mt-3 font-semibold">{p.name}</p>
              <p className="text-sm text-navy-500">{p.brand ?? "—"} · {p.supplier.supplierProfile?.businessName}</p>
              {p.category.requiresSafetyInfo && (
                <p className="mt-2 flex items-center gap-1 text-xs text-harvest-700">
                  <ShieldAlert className="size-3.5" />
                  {p.verification === "VERIFIED" ? "Registration checked by AgriFlow admin" : "Registration not verified by AgriFlow"}
                </p>
              )}
              <div className="mt-auto flex items-end justify-between pt-4">
                <p className="text-lg font-bold text-forest-800">
                  {formatZMW(p.price)} <span className="text-xs font-normal text-navy-500">/ {UNIT_LABEL[p.unit]}</span>
                </p>
                <p className="text-xs text-navy-500">{Number(p.inventoryItem.quantity) > 0 ? `${Number(p.inventoryItem.quantity).toLocaleString()} in stock` : "Out of stock"}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-navy-600">
          <Link href="/auth/login?next=/farmer/marketplace?tab=inputs" className="font-semibold text-forest-700 hover:underline">
            Sign in as a farmer
          </Link>{" "}
          to order inputs.
        </p>
      </Section>
      <CtaBand title="Supply Zambian farmers directly" body="List products, manage stock and receive orders." href="/auth/register?role=SUPPLIER" label="Register as a supplier" />
    </>
  );
}
