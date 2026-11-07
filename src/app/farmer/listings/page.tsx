import type { Metadata } from "next";
import Link from "next/link";
import { Eye, Pause, Pencil, Play, Plus, Tags } from "lucide-react";
import { Badge, Card, Table, THead, TBody, TR, TH, TD } from "@/components/ui/primitives";
import { EmptyState, PageHeader, StatusBadge } from "@/components/layout/page";
import { FormDialog } from "@/components/forms/form-dialog";
import { ActionButton } from "@/components/forms/action-form";
import { ListingForm } from "@/components/marketplace/listing-form";
import { CropArt } from "@/components/marketplace/crop-art";
import { requirePageRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatZMW } from "@/lib/money";
import { UNIT_LABEL } from "@/lib/labels";
import { formatDate, formatNumber, titleCase, toDateInput } from "@/lib/utils";
import { listMyListings } from "@/server/marketplace/service";
import { setListingStatusAction } from "@/server/actions/market";

export const metadata: Metadata = { title: "My listings" };

export default async function ListingsPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const sp = await searchParams;
  const user = await requirePageRole("FARMER");
  const [listings, crops, farms] = await Promise.all([
    listMyListings({ id: user.id, role: user.role }),
    prisma.crop.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, defaultUnit: true } }),
    prisma.farm.findMany({ where: { ownerId: user.id }, select: { id: true, name: true, province: true, district: true } }),
  ]);
  return (
    <>
      <PageHeader
        title="My produce listings"
        description="Publish what you have to sell. Buyers send purchase requests that you can accept, decline or negotiate."
        actions={
          <FormDialog trigger={<><Plus /> New listing</>} title="List produce for sale" wide defaultOpen={sp.new === "1"}>
            <ListingForm crops={crops} farms={farms} defaults={{ province: user.profile?.province, district: user.profile?.district }} />
          </FormDialog>
        }
      />
      {listings.length === 0 ? (
        <EmptyState icon={Tags} title="No listings yet" description="Create a listing to reach buyers across Zambia." />
      ) : (
        <Card>
          <Table>
            <THead>
              <tr>
                <TH>Listing</TH>
                <TH>Price</TH>
                <TH>Available / total</TH>
                <TH>Location</TH>
                <TH>Requests</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {listings.map((l) => (
                <TR key={l.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      {l.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/api/uploads/${l.images[0].uploadId}`} alt="" className="size-11 rounded-lg object-cover" />
                      ) : (
                        <CropArt crop={l.crop.name} className="size-11 rounded-lg" iconClassName="size-5" />
                      )}
                      <div>
                        <p className="font-medium text-navy-900">{l.title}</p>
                        <p className="text-xs text-navy-500">
                          {l.crop.name} · {titleCase(l.qualityGrade)} · listed {formatDate(l.createdAt)}
                        </p>
                      </div>
                    </div>
                  </TD>
                  <TD className="whitespace-nowrap font-medium">
                    {formatZMW(l.pricePerUnit)} <span className="text-xs text-navy-500">/ {UNIT_LABEL[l.unit]}</span>
                  </TD>
                  <TD className="whitespace-nowrap">
                    {formatNumber(l.quantityAvailable.toString())} / {formatNumber(l.totalQuantity.toString())}
                  </TD>
                  <TD>{l.district}</TD>
                  <TD>{l._count.orderItems}</TD>
                  <TD>
                    <div className="flex flex-col items-start gap-1">
                      <StatusBadge status={l.status} />
                      {l.moderationStatus !== "APPROVED" && <Badge tone={l.moderationStatus === "PENDING_REVIEW" ? "slate" : "red"}>{titleCase(l.moderationStatus)}</Badge>}
                    </div>
                  </TD>
                  <TD>
                    <div className="flex justify-end gap-1">
                      <Link href={`/marketplace/${l.id}`} className="inline-flex size-8 items-center justify-center rounded-md text-navy-600 hover:bg-navy-100" aria-label="View">
                        <Eye className="size-4" />
                      </Link>
                      {l.moderationStatus !== "REMOVED" && (
                        <FormDialog trigger={<Pencil />} title="Edit listing" size="icon-sm" variant="ghost" wide>
                          <ListingForm
                            crops={crops}
                            farms={farms}
                            listing={{
                              id: l.id,
                              cropId: l.cropId,
                              farmId: l.farmId,
                              title: l.title,
                              variety: l.variety,
                              totalQuantity: l.totalQuantity.toString(),
                              unit: l.unit,
                              pricePerUnit: l.pricePerUnit.toString(),
                              minOrderQuantity: l.minOrderQuantity?.toString() ?? null,
                              province: l.province,
                              district: l.district,
                              pickupLocation: l.pickupLocation,
                              qualityGrade: l.qualityGrade,
                              harvestDate: toDateInput(l.harvestDate) || null,
                              description: l.description,
                              status: l.status,
                            }}
                          />
                        </FormDialog>
                      )}
                      {l.status === "ACTIVE" ? (
                        <ActionButton size="icon-sm" variant="ghost" aria-label="Pause" action={async () => { "use server"; return setListingStatusAction(l.id, "INACTIVE"); }}>
                          <Pause />
                        </ActionButton>
                      ) : (
                        l.moderationStatus !== "REMOVED" && (
                          <ActionButton size="icon-sm" variant="ghost" aria-label="Publish" action={async () => { "use server"; return setListingStatusAction(l.id, "ACTIVE"); }}>
                            <Play />
                          </ActionButton>
                        )
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </>
  );
}
