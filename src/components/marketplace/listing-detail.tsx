import Link from "next/link";
import { BadgeCheck, CalendarDays, Flag, MapPin, MessageSquare, Package, ShieldCheck } from "lucide-react";
import { Alert, Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { KeyValue } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { ActionButton, ActionForm, SubmitButton, TextAreaField, TextField } from "@/components/forms/action-form";
import { FormDialog } from "@/components/forms/form-dialog";
import { formatZMW } from "@/lib/money";
import { UNIT_LABEL } from "@/lib/labels";
import { provinceLabel } from "@/lib/zambia";
import { formatDate, formatNumber, titleCase } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth/session";
import type { getPublicListing } from "@/server/marketplace/service";
import { purchaseRequestAction, reportListingAction, sendMessageAction } from "@/server/actions/market";
import { CropArt } from "./crop-art";
import { PurchaseRedirect } from "./purchase-redirect";

type Listing = NonNullable<Awaited<ReturnType<typeof getPublicListing>>>;

export function ListingDetail({ listing, user, ordersHref }: { listing: Listing; user: SessionUser | null; ordersHref: string }) {
  const unit = UNIT_LABEL[listing.unit];
  const isBuyer = user?.role === "BUYER";
  const isOwner = user?.id === listing.farmerId;
  const available = Number(listing.quantityAvailable) > 0 && listing.status === "ACTIVE";
  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div className="space-y-6">
        <Card className="overflow-hidden">
          {listing.images.length ? (
            <div className="grid gap-1 sm:grid-cols-2">
              {listing.images.map((img) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={img.id} src={`/api/uploads/${img.uploadId}`} alt={listing.title} className="aspect-[4/3] w-full object-cover" />
              ))}
            </div>
          ) : (
            <CropArt crop={listing.crop.name} className="aspect-[16/7] w-full" iconClassName="size-20" />
          )}
          <CardContent className="space-y-4 pt-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="navy">{listing.crop.name}</Badge>
              {listing.qualityGrade !== "UNGRADED" && <Badge tone="green">{titleCase(listing.qualityGrade)}</Badge>}
              {listing.isDemo && <Badge tone="amber">Demo listing</Badge>}
              {listing.moderationStatus === "PENDING_REVIEW" && <Badge tone="slate">New · awaiting moderator review</Badge>}
            </div>
            <h1 className="text-2xl font-bold sm:text-3xl">{listing.title}</h1>
            <p className="flex items-center gap-1.5 text-sm text-navy-600">
              <MapPin className="size-4" /> {listing.district}, {provinceLabel(listing.province)}
              {listing.pickupLocation ? ` · Pickup: ${listing.pickupLocation}` : ""}
            </p>
            {listing.description && <p className="whitespace-pre-line text-navy-700">{listing.description}</p>}
            <KeyValue
              items={[
                ["Variety", listing.variety ?? "—"],
                ["Quality grade", titleCase(listing.qualityGrade)],
                ["Harvest date", formatDate(listing.harvestDate)],
                ["Minimum order", listing.minOrderQuantity ? `${formatNumber(listing.minOrderQuantity.toString())} ${unit}` : "None"],
                ["Listed", formatDate(listing.createdAt)],
                ["Farm", listing.farm ? `${listing.farm.name}` : "—"],
              ]}
            />
          </CardContent>
        </Card>
      </div>
      <div className="space-y-6">
        <Card>
          <CardContent className="space-y-4 pt-5">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-bold text-forest-800">{formatZMW(listing.pricePerUnit)}</p>
                <p className="text-sm text-navy-500">per {unit} · asking price</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold">{formatNumber(listing.quantityAvailable.toString())}</p>
                <p className="text-xs text-navy-500">{unit} available</p>
              </div>
            </div>
            {!available && <Alert tone="amber">This listing is not currently available.</Alert>}
            {isBuyer && available && (
              <PurchaseRedirect ordersHref={ordersHref}>
                <ActionForm action={purchaseRequestAction} className="space-y-3" refresh={false}>
                  <input type="hidden" name="listingId" value={listing.id} />
                  <div className="grid grid-cols-2 gap-3">
                    <TextField name="quantity" label={`Quantity (${unit})`} type="number" step="0.01" min={0} required defaultValue={listing.minOrderQuantity?.toString() ?? ""} />
                    <TextField name="offerPrice" label="Your price (optional)" type="number" step="0.01" min={0} hint={`Leave blank to accept ${formatZMW(listing.pricePerUnit)}`} />
                  </div>
                  <TextField name="deliveryAddress" label="Delivery to (optional)" placeholder="Town / warehouse" />
                  <TextAreaField name="message" label="Message to farmer" rows={2} placeholder="e.g. Can collect next week. Please confirm moisture level." />
                  <SubmitButton className="w-full" size="lg">
                    Send purchase request
                  </SubmitButton>
                  <p className="text-xs text-navy-500">The farmer can accept, decline or counteroffer. Nothing is reserved until you confirm the agreed deal.</p>
                </ActionForm>
              </PurchaseRedirect>
            )}
            {!user && (
              <div className="space-y-2">
                <Button asChild className="w-full" size="lg">
                  <Link href={`/auth/login?next=/buyer/marketplace/${listing.id}`}>Sign in to buy</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/auth/register?role=BUYER">Create a buyer account</Link>
                </Button>
              </div>
            )}
            {user && !isBuyer && !isOwner && <Alert tone="slate">Purchase requests are available to buyer accounts.</Alert>}
            {isOwner && (
              <Button asChild variant="outline" className="w-full">
                <Link href="/farmer/listings">Manage this listing</Link>
              </Button>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Farmer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="flex items-center gap-1.5 font-semibold">
              {listing.farmer.profile?.fullName}
              {listing.farmer.verifiedAt && (
                <Badge tone="green">
                  <BadgeCheck className="size-3.5" /> Verified
                </Badge>
              )}
            </p>
            <ul className="space-y-1.5 text-sm text-navy-600">
              <li className="flex items-center gap-2">
                <MapPin className="size-4 text-navy-400" /> {listing.farmer.profile?.district}, {provinceLabel(listing.farmer.profile?.province)}
              </li>
              <li className="flex items-center gap-2">
                <CalendarDays className="size-4 text-navy-400" /> Member since {formatDate(listing.farmer.createdAt, { month: "long", year: "numeric" })}
              </li>
              <li className="flex items-center gap-2">
                <Package className="size-4 text-navy-400" /> {listing.farmer._count.ordersAsSeller} completed sales
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-navy-400" /> Contact details are shared after an order is confirmed
              </li>
            </ul>
            {user && !isOwner && (
              <div className="flex flex-wrap gap-2">
                <FormDialog trigger={<><MessageSquare /> Message farmer</>} title="Message the farmer" variant="outline">
                  <ActionForm action={sendMessageAction} className="space-y-3" successMessage="Message sent. Find replies in Messages.">
                    <input type="hidden" name="listingId" value={listing.id} />
                    <TextAreaField name="body" label="Message" required rows={4} />
                    <SubmitButton>Send</SubmitButton>
                  </ActionForm>
                </FormDialog>
                <ActionButton variant="ghost" size="sm" promptNote="What is wrong with this listing?" action={async (reason?: string) => { "use server"; return reportListingAction(listing.id, reason); }}>
                  <Flag /> Report
                </ActionButton>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
