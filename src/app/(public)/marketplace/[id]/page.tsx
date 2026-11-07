import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ListingDetail } from "@/components/marketplace/listing-detail";
import { getCurrentUser } from "@/lib/auth/session";
import { getPublicListing } from "@/server/marketplace/service";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const l = await getPublicListing(id).catch(() => null);
  return { title: l ? `${l.title} · ${l.district}` : "Listing" };
}

export default async function PublicListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [listing, user] = await Promise.all([getPublicListing(id), getCurrentUser()]);
  if (!listing) notFound();
  if (user?.role === "BUYER") redirect(`/buyer/marketplace/${id}`);
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/marketplace" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-navy-500 hover:text-forest-700">
        <ChevronLeft className="size-4" /> Marketplace
      </Link>
      <ListingDetail listing={listing} user={user} ordersHref="/buyer/orders" />
    </div>
  );
}
