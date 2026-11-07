import Link from "next/link";
import { Search, ShoppingBasket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/primitives";
import { EmptyState } from "@/components/layout/page";
import { prisma } from "@/lib/db";
import { PROVINCES } from "@/lib/zambia";
import { searchListings } from "@/server/marketplace/service";
import { ListingCard } from "./listing-card";

/** Server-rendered marketplace browser (GET form: works without JavaScript and is linkable). */
export async function MarketplaceBrowser({ searchParams, basePath, detailBase, extraParams = {} }: { searchParams: Record<string, string | undefined>; basePath: string; detailBase: string; extraParams?: Record<string, string> }) {
  const clean = Object.fromEntries(Object.entries(searchParams).filter(([k, v]) => v !== undefined && v !== "" && !(k in extraParams)));
  let result;
  try {
    result = await searchListings(clean);
  } catch {
    result = await searchListings({});
  }
  const crops = await prisma.crop.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { name: true } });
  const f = result.filters;
  const qs = (page: number) => {
    const p = new URLSearchParams({ ...extraParams, ...(clean as Record<string, string>) });
    p.set("page", String(page));
    return `${basePath}?${p}`;
  };
  return (
    <div className="space-y-6">
      <form method="get" action={basePath} className="grid gap-3 rounded-2xl border border-border bg-white p-4 shadow-[var(--shadow-card)] sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto]">
        {Object.entries(extraParams).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <label className="relative sm:col-span-2 lg:col-span-1">
          <span className="sr-only">Search</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-navy-400" />
          <Input name="q" defaultValue={f.q ?? ""} placeholder="Search maize, soybeans, district…" className="pl-9" />
        </label>
        <Select name="crop" defaultValue={f.crop ?? ""} aria-label="Crop">
          <option value="">All crops</option>
          {crops.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select name="province" defaultValue={f.province ?? ""} aria-label="Province">
          <option value="">All provinces</option>
          {PROVINCES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
        <Input name="district" defaultValue={f.district ?? ""} placeholder="District" aria-label="District" />
        <div className="grid grid-cols-2 gap-2">
          <Input name="minPrice" type="number" min={0} step="0.01" defaultValue={f.minPrice ?? ""} placeholder="Min K" aria-label="Minimum price" />
          <Input name="maxPrice" type="number" min={0} step="0.01" defaultValue={f.maxPrice ?? ""} placeholder="Max K" aria-label="Maximum price" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input name="minQty" type="number" min={0} defaultValue={f.minQty ?? ""} placeholder="Min qty" aria-label="Minimum quantity" />
          <Select name="sort" defaultValue={f.sort} aria-label="Sort">
            <option value="newest">Newest</option>
            <option value="price_asc">Price ↑</option>
            <option value="price_desc">Price ↓</option>
            <option value="qty_desc">Most stock</option>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button type="submit" className="flex-1">
            Search
          </Button>
          <Button asChild variant="ghost">
            <Link href={`${basePath}${Object.keys(extraParams).length ? `?${new URLSearchParams(extraParams)}` : ""}`}>Reset</Link>
          </Button>
        </div>
      </form>
      <p className="text-sm text-navy-500">
        {result.total} listing{result.total === 1 ? "" : "s"} found. Prices are the farmer&apos;s asking price (user-submitted), not verified market prices.
      </p>
      {result.items.length === 0 ? (
        <EmptyState icon={ShoppingBasket} title="No matching produce" description="Try removing some filters." />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {result.items.map((l) => (
            <ListingCard key={l.id} listing={l} href={`${detailBase}/${l.id}`} />
          ))}
        </div>
      )}
      {result.pages > 1 && (
        <nav className="flex items-center justify-center gap-2" aria-label="Pagination">
          {result.page > 1 && (
            <Button asChild variant="outline" size="sm">
              <Link href={qs(result.page - 1)}>Previous</Link>
            </Button>
          )}
          <span className="text-sm text-navy-500">
            Page {result.page} of {result.pages}
          </span>
          {result.page < result.pages && (
            <Button asChild variant="outline" size="sm">
              <Link href={qs(result.page + 1)}>Next</Link>
            </Button>
          )}
        </nav>
      )}
    </div>
  );
}
