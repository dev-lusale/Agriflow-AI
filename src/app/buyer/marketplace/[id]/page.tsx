import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page";
import { ListingDetail } from "@/components/marketplace/listing-detail";
import { requirePageRole } from "@/lib/auth/session";
import { getPublicListing } from "@/server/marketplace/service";

export const metadata: Metadata = { title: "Listing" };

export default async function BuyerListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageRole("BUYER");
  const listing = await getPublicListing(id);
  if (!listing) notFound();
  return (
    <>
      <PageHeader back={{ href: "/buyer/marketplace", label: "Marketplace" }} title="Listing" />
      <ListingDetail listing={listing} user={user} ordersHref="/buyer/orders" />
    </>
  );
}
