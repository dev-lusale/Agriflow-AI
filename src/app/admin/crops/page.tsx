import type { Metadata } from "next";
import { Pencil, Plus } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle, Table, THead, TBody, TR, TH, TD } from "@/components/ui/primitives";
import { PageHeader } from "@/components/layout/page";
import { FormDialog } from "@/components/forms/form-dialog";
import { ActionButton } from "@/components/forms/action-form";
import { CategoryForm, CropForm } from "@/components/admin/catalog-forms";
import { requirePageRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { UNIT_LABEL } from "@/lib/labels";
import { provinceLabel } from "@/lib/zambia";
import { setDistrictActiveAction } from "@/server/actions/admin";

export const metadata: Metadata = { title: "Crops, categories & regions" };

export default async function AdminCropsPage() {
  await requirePageRole("ADMIN", "SUPER_ADMIN");
  const [crops, categories, districts] = await Promise.all([
    prisma.crop.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { cropRecords: true, listings: true } } } }),
    prisma.productCategory.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { products: true } } } }),
    prisma.district.findMany({ orderBy: [{ province: "asc" }, { name: "asc" }] }),
  ]);
  return (
    <>
      <PageHeader title="Crops, categories & regions" description="Configure the crops farmers can record and list, input product categories, and agricultural regions." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Crops</CardTitle>
            <FormDialog trigger={<><Plus /> Add crop</>} title="Add a crop" size="sm" variant="secondary">
              <CropForm />
            </FormDialog>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <THead>
                <tr>
                  <TH>Crop</TH>
                  <TH>Category</TH>
                  <TH>Default unit</TH>
                  <TH>Records / listings</TH>
                  <TH />
                </tr>
              </THead>
              <TBody>
                {crops.map((c) => (
                  <TR key={c.id}>
                    <TD className="font-medium">
                      {c.name} {!c.isActive && <Badge>inactive</Badge>}
                    </TD>
                    <TD>{c.category}</TD>
                    <TD>{UNIT_LABEL[c.defaultUnit]}</TD>
                    <TD>
                      {c._count.cropRecords} / {c._count.listings}
                    </TD>
                    <TD>
                      <FormDialog trigger={<Pencil />} title={`Edit ${c.name}`} size="icon-sm" variant="ghost">
                        <CropForm crop={{ id: c.id, name: c.name, category: c.category, defaultUnit: c.defaultUnit, isActive: c.isActive }} />
                      </FormDialog>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Input product categories</CardTitle>
            <FormDialog trigger={<><Plus /> Add category</>} title="Add a category" size="sm" variant="secondary">
              <CategoryForm />
            </FormDialog>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <THead>
                <tr>
                  <TH>Category</TH>
                  <TH>Safety info</TH>
                  <TH>Products</TH>
                  <TH />
                </tr>
              </THead>
              <TBody>
                {categories.map((c) => (
                  <TR key={c.id}>
                    <TD className="font-medium">
                      {c.name} {!c.isActive && <Badge>inactive</Badge>}
                    </TD>
                    <TD>{c.requiresSafetyInfo ? <Badge tone="amber">Required</Badge> : "—"}</TD>
                    <TD>{c._count.products}</TD>
                    <TD>
                      <FormDialog trigger={<Pencil />} title={`Edit ${c.name}`} size="icon-sm" variant="ghost">
                        <CategoryForm category={{ id: c.id, name: c.name, requiresSafetyInfo: c.requiresSafetyInfo, isActive: c.isActive }} />
                      </FormDialog>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Agricultural regions (districts)</CardTitle>
          <p className="text-xs text-navy-500">Coordinates are approximate district-town locations, used only for area weather when a farm has no GPS. Districts without coordinates require farm GPS for weather.</p>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <THead>
              <tr>
                <TH>Province</TH>
                <TH>District</TH>
                <TH>Reference point</TH>
                <TH>Status</TH>
                <TH />
              </tr>
            </THead>
            <TBody>
              {districts.map((d) => (
                <TR key={d.id}>
                  <TD>{provinceLabel(d.province)}</TD>
                  <TD className="font-medium">{d.name}</TD>
                  <TD className="text-xs">{d.latitude ? `${d.latitude.toString()}, ${d.longitude?.toString()}` : <Badge>none</Badge>}</TD>
                  <TD>{d.isActive ? <Badge tone="green">active</Badge> : <Badge>inactive</Badge>}</TD>
                  <TD>
                    <ActionButton size="sm" variant="ghost" action={async () => { "use server"; return setDistrictActiveAction(d.id, !d.isActive); }}>
                      {d.isActive ? "Deactivate" : "Activate"}
                    </ActionButton>
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
