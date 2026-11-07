import type { Metadata } from "next";
import Link from "next/link";
import { Check, Flag, Trash2 } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle, Table, THead, TBody, TR, TH, TD } from "@/components/ui/primitives";
import { EmptyState, PageHeader, StatusBadge } from "@/components/layout/page";
import { ActionButton } from "@/components/forms/action-form";
import { requirePageRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatZMW } from "@/lib/money";
import { UNIT_LABEL } from "@/lib/labels";
import { cn, formatDate, formatNumber, relativeTime, titleCase } from "@/lib/utils";
import { moderateListingAction, moderateProductAction, resolveReportAction } from "@/server/actions/admin";

export const metadata: Metadata = { title: "Marketplace moderation" };

export default async function AdminMarketplacePage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter = "PENDING_REVIEW" } = await searchParams;
  const where = filter === "ALL" ? {} : { moderationStatus: filter as "PENDING_REVIEW" | "FLAGGED" | "REMOVED" | "APPROVED" };
  await requirePageRole("ADMIN", "SUPER_ADMIN");
  const [listings, reports, products, counts] = await Promise.all([
    prisma.produceListing.findMany({ where, orderBy: { createdAt: "desc" }, take: 100, include: { crop: true, farmer: { select: { verifiedAt: true, profile: { select: { fullName: true } } } } } }),
    prisma.contentReport.findMany({ where: { status: "OPEN" }, orderBy: { createdAt: "desc" }, include: { reporter: { select: { profile: { select: { fullName: true } } } } } }),
    prisma.supplierProduct.findMany({ where: { category: { requiresSafetyInfo: true } }, include: { category: true, supplier: { select: { supplierProfile: { select: { businessName: true } } } } }, orderBy: { createdAt: "desc" } }),
    prisma.produceListing.groupBy({ by: ["moderationStatus"], _count: true }),
  ]);
  const count = (s: string) => counts.find((c) => c.moderationStatus === s)?._count ?? 0;
  return (
    <>
      <PageHeader title="Marketplace moderation" description="Review new produce listings, handle reported content, and verify crop-protection product registrations." />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {[
          ["PENDING_REVIEW", `Awaiting review (${count("PENDING_REVIEW")})`],
          ["FLAGGED", `Flagged (${count("FLAGGED")})`],
          ["REMOVED", `Removed (${count("REMOVED")})`],
          ["APPROVED", `Approved (${count("APPROVED")})`],
          ["ALL", "All"],
        ].map(([k, l]) => (
          <Link key={k} href={`?filter=${k}`} className={cn("rounded-full px-3.5 py-1.5 font-medium ring-1 transition-colors", filter === k ? "bg-ink text-white ring-ink shadow-sm" : "bg-white/80 text-navy-700 ring-black/5 hover:bg-white")}>
            {l}
          </Link>
        ))}
      </div>
      <Card className="mb-6">
        {listings.length === 0 ? (
          <EmptyState title="Nothing here" className="border-0" />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Listing</TH>
                <TH>Farmer</TH>
                <TH>Price</TH>
                <TH>Quantity</TH>
                <TH>Listed</TH>
                <TH>Moderation</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {listings.map((l) => (
                <TR key={l.id}>
                  <TD>
                    <Link href={`/marketplace/${l.id}`} className="font-medium text-navy-900 hover:text-forest-700">
                      {l.title}
                    </Link>
                    <p className="text-xs text-navy-500">
                      {l.crop.name} · {l.district} {l.isDemo && "· demo"}
                    </p>
                    {l.moderationNote && <p className="text-xs text-red-600">Note: {l.moderationNote}</p>}
                  </TD>
                  <TD>
                    {l.farmer.profile?.fullName} {l.farmer.verifiedAt && <Badge tone="green">verified</Badge>}
                  </TD>
                  <TD className="whitespace-nowrap">
                    {formatZMW(l.pricePerUnit)} / {UNIT_LABEL[l.unit]}
                  </TD>
                  <TD>{formatNumber(l.quantityAvailable.toString())}</TD>
                  <TD className="text-xs">{formatDate(l.createdAt)}</TD>
                  <TD>
                    <StatusBadge status={l.moderationStatus} />
                  </TD>
                  <TD>
                    <div className="flex justify-end gap-1">
                      {l.moderationStatus !== "APPROVED" && (
                        <ActionButton size="sm" variant="secondary" action={async () => { "use server"; return moderateListingAction(l.id, "APPROVED"); }}>
                          <Check /> Approve
                        </ActionButton>
                      )}
                      {l.moderationStatus !== "FLAGGED" && l.moderationStatus !== "REMOVED" && (
                        <ActionButton size="sm" variant="outline" promptNote="Reason for flagging (sent to farmer):" action={async (note?: string) => { "use server"; return moderateListingAction(l.id, "FLAGGED", note); }}>
                          <Flag /> Flag
                        </ActionButton>
                      )}
                      {l.moderationStatus !== "REMOVED" && (
                        <ActionButton size="sm" variant="danger-outline" promptNote="Reason for removal (sent to farmer):" action={async (note?: string) => { "use server"; return moderateListingAction(l.id, "REMOVED", note); }}>
                          <Trash2 /> Remove
                        </ActionButton>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card id="reports">
          <CardHeader>
            <CardTitle>Reported content</CardTitle>
          </CardHeader>
          <CardContent>
            {reports.length === 0 ? (
              <p className="text-sm text-navy-500">No open reports.</p>
            ) : (
              <ul className="space-y-3">
                {reports.map((r) => (
                  <li key={r.id} className="rounded-xl border border-border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone="red">{titleCase(r.entityType)}</Badge>
                      <span className="text-xs text-navy-400">{relativeTime(r.createdAt)}</span>
                    </div>
                    <p className="mt-2">{r.reason}</p>
                    <p className="mt-1 text-xs text-navy-500">
                      Reported by {r.reporter.profile?.fullName}
                      {r.entityType === "LISTING" && (
                        <>
                          {" · "}
                          <Link href={`/marketplace/${r.entityId}`} className="font-semibold text-forest-700">
                            View listing
                          </Link>
                        </>
                      )}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <ActionButton size="sm" variant="secondary" promptNote="Resolution note:" action={async (n?: string) => { "use server"; return resolveReportAction(r.id, "RESOLVED", n); }}>
                        Resolve
                      </ActionButton>
                      <ActionButton size="sm" variant="ghost" action={async () => { "use server"; return resolveReportAction(r.id, "DISMISSED"); }}>
                        Dismiss
                      </ActionButton>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Crop-protection products</CardTitle>
            <p className="text-xs text-navy-500">Check declared registration numbers against the regulator before marking them verified.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {products.map((p) => (
              <div key={p.id} className="flex items-start justify-between gap-3 rounded-xl border border-border p-3 text-sm">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-navy-500">
                    {p.supplier.supplierProfile?.businessName} · Reg. {p.registrationNumber ?? "not provided"}
                  </p>
                  <div className="mt-1 flex gap-1">
                    <Badge tone={p.verification === "VERIFIED" ? "green" : "amber"}>{p.verification.toLowerCase()}</Badge>
                    {p.moderationStatus === "REMOVED" && <Badge tone="red">removed</Badge>}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <ActionButton size="sm" variant="secondary" action={async () => { "use server"; return moderateProductAction(p.id, p.verification === "VERIFIED" ? "UNVERIFY" : "VERIFY"); }}>
                    {p.verification === "VERIFIED" ? "Unverify" : "Mark verified"}
                  </ActionButton>
                  <ActionButton size="sm" variant={p.moderationStatus === "REMOVED" ? "outline" : "danger-outline"} action={async () => { "use server"; return moderateProductAction(p.id, p.moderationStatus === "REMOVED" ? "RESTORE" : "REMOVE"); }}>
                    {p.moderationStatus === "REMOVED" ? "Restore" : "Remove"}
                  </ActionButton>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
