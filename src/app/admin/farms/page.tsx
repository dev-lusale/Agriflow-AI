import type { Metadata } from "next";
import { Badge, Card, CardContent, CardHeader, CardTitle, Table, THead, TBody, TR, TH, TD } from "@/components/ui/primitives";
import { PageHeader } from "@/components/layout/page";
import { requirePageRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { ACTIVITY_LABEL } from "@/lib/labels";
import { formatZMW } from "@/lib/money";
import { provinceLabel } from "@/lib/zambia";
import { formatDate, formatNumber, titleCase } from "@/lib/utils";

export const metadata: Metadata = { title: "Farms & activities" };

export default async function AdminFarmsPage() {
  await requirePageRole("ADMIN", "SUPER_ADMIN");
  const [farms, activities] = await Promise.all([
    prisma.farm.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { owner: { select: { isDemo: true, profile: { select: { fullName: true } } } }, _count: { select: { fields: true, cropRecords: true, activities: true } } } }),
    prisma.farmActivity.findMany({ orderBy: { date: "desc" }, take: 30, include: { farm: { select: { name: true, district: true } }, cropRecord: { include: { crop: true } } } }),
  ]);
  return (
    <>
      <PageHeader title="Farms & crop activities" description={`${farms.length} farms registered. Recent field activity across the platform.`} />
      <Card className="mb-6">
        <Table>
          <THead>
            <tr>
              <TH>Farm</TH>
              <TH>Owner</TH>
              <TH>Location</TH>
              <TH>Size</TH>
              <TH>Type</TH>
              <TH>Fields / crops / activities</TH>
              <TH>GPS</TH>
              <TH>Registered</TH>
            </tr>
          </THead>
          <TBody>
            {farms.map((f) => (
              <TR key={f.id}>
                <TD className="font-medium text-navy-900">
                  {f.name} {f.owner.isDemo && <Badge tone="amber">Demo</Badge>}
                </TD>
                <TD>{f.owner.profile?.fullName}</TD>
                <TD>
                  {f.district}, {provinceLabel(f.province)}
                </TD>
                <TD>
                  {formatNumber(f.size.toString())} {f.sizeUnit === "ACRES" ? "ac" : "ha"}
                </TD>
                <TD>{titleCase(f.farmingType)}</TD>
                <TD>
                  {f._count.fields} / {f._count.cropRecords} / {f._count.activities}
                </TD>
                <TD>{f.latitude ? <Badge tone="green">Yes</Badge> : <Badge>No</Badge>}</TD>
                <TD className="text-xs">{formatDate(f.createdAt)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Recent crop activities</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <THead>
              <tr>
                <TH>Date</TH>
                <TH>Activity</TH>
                <TH>Farm</TH>
                <TH>Crop</TH>
                <TH>Cost</TH>
              </tr>
            </THead>
            <TBody>
              {activities.map((a) => (
                <TR key={a.id}>
                  <TD className="text-xs">{formatDate(a.date)}</TD>
                  <TD>{ACTIVITY_LABEL[a.type]}</TD>
                  <TD>
                    {a.farm.name} <span className="text-xs text-navy-500">({a.farm.district})</span>
                  </TD>
                  <TD>{a.cropRecord?.crop.name ?? "—"}</TD>
                  <TD>{a.cost ? formatZMW(a.cost) : "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
