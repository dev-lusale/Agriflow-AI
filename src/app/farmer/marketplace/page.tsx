import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, LineChart, Package, Search, ShieldAlert } from "lucide-react";
import { Badge, Card, Input, Select } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/layout/page";
import { FormDialog } from "@/components/forms/form-dialog";
import { ActionForm, SubmitButton, TextAreaField, TextField } from "@/components/forms/action-form";
import { MarketplaceBrowser } from "@/components/marketplace/browse";
import { requirePageRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatZMW } from "@/lib/money";
import { UNIT_LABEL } from "@/lib/labels";
import { provinceLabel } from "@/lib/zambia";
import { cn, formatNumber } from "@/lib/utils";
import { browseProducts } from "@/server/suppliers/service";
import { inputOrderAction } from "@/server/actions/market";

export const metadata: Metadata = { title: "Market & inputs" };

export default async function FarmerMarketplacePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  await requirePageRole("FARMER");
  const tab = sp.tab === "produce" ? "produce" : "inputs";
  return (
    <>
      <PageHeader
        title="Market & inputs"
        description="Order seed, fertilizer and equipment from suppliers, or see what other farmers are selling."
        actions={
          <Button asChild variant="outline">
            <Link href="/marketplace/prices">
              <LineChart /> Price intelligence
            </Link>
          </Button>
        }
      />
      <div className="mb-5 inline-flex rounded-xl border border-border bg-white p-1 text-sm">
        {[
          ["inputs", "Agricultural inputs"],
          ["produce", "Produce market"],
        ].map(([k, l]) => (
          <Link key={k} href={`?tab=${k}`} className={cn("rounded-lg px-4 py-1.5 font-medium", tab === k ? "bg-forest-800 text-white" : "text-navy-600 hover:text-navy-900")}>
            {l}
          </Link>
        ))}
      </div>
      {tab === "produce" ? (
        <MarketplaceBrowser searchParams={sp} basePath="/farmer/marketplace" extraParams={{ tab: "produce" }} detailBase="/marketplace" />
      ) : (
        <InputsCatalog q={sp.q} category={sp.category} />
      )}
    </>
  );
}

async function InputsCatalog({ q, category }: { q?: string; category?: string }) {
  const [products, categories] = await Promise.all([browseProducts({ q, category }), prisma.productCategory.findMany({ where: { isActive: true, kind: "INPUT" }, orderBy: { name: "asc" } })]);
  return (
    <div className="space-y-5">
      <form method="get" className="flex flex-col gap-2 sm:flex-row">
        <input type="hidden" name="tab" value="inputs" />
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-navy-400" />
          <Input name="q" defaultValue={q ?? ""} placeholder="Search seed, fertilizer, sprayer…" className="pl-9" />
        </label>
        <Select name="category" defaultValue={category ?? ""} className="sm:w-56" aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </Select>
        <Button type="submit">Search</Button>
      </form>
      {products.length === 0 ? (
        <EmptyState icon={Package} title="No products found" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((p) => {
            const stock = Number(p.inventoryItem.quantity);
            return (
              <Card key={p.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  {p.imageId ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/uploads/${p.imageId}`} alt="" className="size-14 rounded-xl object-cover" />
                  ) : (
                    <div className="flex size-12 items-center justify-center rounded-xl bg-forest-50 text-forest-700">
                      <Package className="size-6" />
                    </div>
                  )}
                  <div className="flex flex-wrap justify-end gap-1">
                    <Badge>{p.category.name}</Badge>
                    {p.isDemo && <Badge tone="amber">Demo</Badge>}
                  </div>
                </div>
                <p className="mt-3 font-semibold">{p.name}</p>
                <p className="flex items-center gap-1 text-sm text-navy-500">
                  {p.supplier.supplierProfile?.businessName}
                  {p.supplier.verifiedAt && <BadgeCheck className="size-3.5 text-forest-600" />}
                  <span>· {p.supplier.profile?.district}, {provinceLabel(p.supplier.profile?.province)}</span>
                </p>
                {p.description && <p className="mt-2 line-clamp-2 text-sm text-navy-600">{p.description}</p>}
                {p.category.requiresSafetyInfo && (
                  <div className="mt-3 rounded-lg bg-harvest-50 p-2.5 text-xs text-harvest-900">
                    <p className="flex items-center gap-1 font-semibold">
                      <ShieldAlert className="size-3.5" />
                      {p.verification === "VERIFIED" ? `Registration ${p.registrationNumber} checked by AgriFlow admin` : `Registration ${p.registrationNumber ?? "not provided"}: not verified by AgriFlow`}
                    </p>
                    {p.safetyInfo && <p className="mt-1">{p.safetyInfo}</p>}
                  </div>
                )}
                <div className="mt-auto flex items-end justify-between gap-2 pt-4">
                  <div>
                    <p className="text-lg font-bold text-forest-800">{formatZMW(p.price)}</p>
                    <p className="text-xs text-navy-500">
                      per {UNIT_LABEL[p.unit]} · {stock > 0 ? `${formatNumber(stock)} in stock` : "out of stock"}
                    </p>
                  </div>
                  {stock > 0 && (
                    <FormDialog trigger="Order" title={`Order ${p.name}`} description={`${formatZMW(p.price)} per ${UNIT_LABEL[p.unit]}. The supplier confirms availability before you pay.`} size="sm">
                      <ActionForm action={inputOrderAction} className="space-y-3" successMessage="Order sent. Track it under Orders → Input purchases.">
                        <input type="hidden" name="productId" value={p.id} />
                        <TextField name="quantity" label={`Quantity (${UNIT_LABEL[p.unit]})`} type="number" min={1} max={stock} step="1" required defaultValue="1" />
                        <TextField name="deliveryAddress" label="Deliver to / collect from" placeholder="Farm or town" />
                        <TextAreaField name="notes" label="Notes" rows={2} />
                        <SubmitButton className="w-full">Send purchase order</SubmitButton>
                      </ActionForm>
                    </FormDialog>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
