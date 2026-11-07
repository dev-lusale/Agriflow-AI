import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Table, THead, TBody, TR, TH, TD } from "@/components/ui/primitives";
import { DataLabel, PageHeader } from "@/components/layout/page";
import { FormDialog } from "@/components/forms/form-dialog";
import { MarketPriceForm } from "@/components/admin/market-price-form";
import { requirePageRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatZMW } from "@/lib/money";
import { UNIT_LABEL } from "@/lib/labels";
import { provinceLabel } from "@/lib/zambia";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Market prices" };
const KIND = { VERIFIED_OBSERVATION: "VERIFIED", USER_SUBMITTED_OFFER: "USER_OFFER", HISTORICAL_RECORD: "HISTORICAL", DEMO: "DEMO" } as const;

export default async function AdminPricesPage() {
  await requirePageRole("ADMIN", "SUPER_ADMIN");
  const [rows, crops, counts] = await Promise.all([
    prisma.marketPrice.findMany({ orderBy: [{ observedOn: "desc" }, { createdAt: "desc" }], take: 150, include: { crop: true, verifiedBy: { select: { profile: { select: { fullName: true } } } } } }),
    prisma.crop.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.marketPrice.groupBy({ by: ["sourceType"], _count: true }),
  ]);
  return (
    <>
      <PageHeader
        title="Market prices"
        description="Record verified market observations with their source. They power the public price-intelligence page and Grok's market explanations. Never enter estimated or invented prices."
        actions={
          <>
            <Link href="/marketplace/prices" className="text-sm font-semibold text-forest-700 hover:underline">
              Public view
            </Link>
            <FormDialog trigger={<><Plus /> Record price</>} title="Record a market price" wide>
              <MarketPriceForm crops={crops} />
            </FormDialog>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap gap-3">
        {counts.map((c) => (
          <span key={c.sourceType} className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm">
            <DataLabel kind={KIND[c.sourceType]} /> {c._count}
          </span>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Latest records</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <THead>
              <tr>
                <TH>Observed</TH>
                <TH>Crop</TH>
                <TH>Province / market</TH>
                <TH>Price</TH>
                <TH>Source</TH>
                <TH>Label</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD className="text-xs">{formatDate(r.observedOn)}</TD>
                  <TD>{r.crop.name}</TD>
                  <TD>
                    {provinceLabel(r.province)}
                    {r.marketName ? ` · ${r.marketName}` : ""}
                  </TD>
                  <TD className="whitespace-nowrap font-medium">
                    {formatZMW(r.price)} / {UNIT_LABEL[r.unit]}
                  </TD>
                  <TD className="max-w-64 truncate text-xs">
                    {r.sourceName}
                    {r.verifiedBy && ` · verified by ${r.verifiedBy.profile?.fullName}`}
                  </TD>
                  <TD>
                    <DataLabel kind={KIND[r.sourceType]} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
