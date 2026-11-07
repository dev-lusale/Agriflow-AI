import Link from "next/link";
import { BadgeCheck, MapPin } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { Badge } from "@/components/ui/primitives";
import { formatZMW } from "@/lib/money";
import { UNIT_LABEL } from "@/lib/labels";
import { provinceLabel } from "@/lib/zambia";
import { formatNumber, titleCase } from "@/lib/utils";
import { CropArt } from "./crop-art";

export type ListingCardData = Prisma.ProduceListingGetPayload<{
  include: { crop: true; images: true; farmer: { select: { id: true; verifiedAt: true; profile: { select: { fullName: true } } } } };
}>;

export function ListingCard({ listing, href }: { listing: ListingCardData; href: string }) {
  const img = listing.images[0];
  return (
    <Link href={href} className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
      <div className="relative aspect-[16/10]">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/uploads/${img.uploadId}`} alt={listing.title} className="size-full object-cover" loading="lazy" />
        ) : (
          <CropArt crop={listing.crop.name} className="size-full" />
        )}
        <div className="absolute left-3 top-3 flex gap-1.5">
          <Badge tone="navy">{listing.crop.name}</Badge>
          {listing.qualityGrade !== "UNGRADED" && <Badge tone="green">{titleCase(listing.qualityGrade)}</Badge>}
        </div>
        {listing.isDemo && <Badge tone="amber" className="absolute right-3 top-3">Demo</Badge>}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 font-semibold text-navy-900 group-hover:text-forest-700">{listing.title}</h3>
        </div>
        <p className="flex items-center gap-1 text-xs text-navy-500">
          <MapPin className="size-3.5" />
          {listing.district}, {provinceLabel(listing.province)}
        </p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div>
            <p className="text-lg font-bold text-forest-800">{formatZMW(listing.pricePerUnit)}</p>
            <p className="text-xs text-navy-500">per {UNIT_LABEL[listing.unit]}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-navy-800">{formatNumber(listing.quantityAvailable.toString())}</p>
            <p className="text-xs text-navy-500">{UNIT_LABEL[listing.unit]} available</p>
          </div>
        </div>
        <p className="flex items-center gap-1 border-t border-border pt-2 text-xs text-navy-500">
          {listing.farmer.profile?.fullName ?? "Farmer"}
          {listing.farmer.verifiedAt && <BadgeCheck className="size-3.5 text-forest-600" aria-label="Verified" />}
        </p>
      </div>
    </Link>
  );
}
