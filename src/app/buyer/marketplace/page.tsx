import type { Metadata } from "next";
import Link from "next/link";
import { LineChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page";
import { MarketplaceBrowser } from "@/components/marketplace/browse";

export const metadata: Metadata = { title: "Marketplace" };

export default async function BuyerMarketplacePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return (
    <>
      <PageHeader
        title="Marketplace"
        description="Search produce by crop, location, price and quantity. Open a listing to request a purchase or message the farmer."
        actions={
          <Button asChild variant="outline">
            <Link href="/marketplace/prices">
              <LineChart /> Price intelligence
            </Link>
          </Button>
        }
      />
      <MarketplaceBrowser searchParams={sp} basePath="/buyer/marketplace" detailBase="/buyer/marketplace" />
    </>
  );
}
