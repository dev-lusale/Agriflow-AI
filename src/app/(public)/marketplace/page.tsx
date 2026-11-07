import type { Metadata } from "next";
import Link from "next/link";
import { LineChart } from "lucide-react";
import { MarketplaceBrowser } from "@/components/marketplace/browse";

export const metadata: Metadata = { title: "Marketplace" };

export default async function PublicMarketplacePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-forest-600">Agricultural marketplace</p>
          <h1 className="mt-1 text-3xl font-bold">Buy produce directly from Zambian farmers</h1>
          <p className="mt-1 max-w-2xl text-navy-600">Maize, soybeans, groundnuts, beans, rice, vegetables and more. Sign in as a buyer to send purchase requests and negotiate.</p>
        </div>
        <Link href="/marketplace/prices" className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest-700 hover:underline">
          <LineChart className="size-4" /> Market price intelligence
        </Link>
      </div>
      <MarketplaceBrowser searchParams={sp} basePath="/marketplace" detailBase="/marketplace" />
    </div>
  );
}
