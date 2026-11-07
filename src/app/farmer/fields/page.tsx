import type { Metadata } from "next";
import Link from "next/link";
import { Grid3x3, Plus } from "lucide-react";
import { Card, Table, THead, TBody, TR, TH, TD } from "@/components/ui/primitives";
import { EmptyState, PageHeader, StatusBadge } from "@/components/layout/page";
import { FormDialog } from "@/components/forms/form-dialog";
import { FieldForm } from "@/components/farm/forms";
import { requirePageRole } from "@/lib/auth/session";
import { formatDate, formatNumber, titleCase } from "@/lib/utils";
import { listFields } from "@/server/farms/service";
import { farmOptions } from "@/server/farms/options";

export const metadata: Metadata = { title: "Fields" };

export default async function FieldsPage() {
  const user = await requirePageRole("FARMER");
  const [fields, opts] = await Promise.all([listFields({ id: user.id, role: user.role }), farmOptions(user.id)]);
  const farms = opts.map((f) => ({ id: f.id, name: f.name }));
  return (
    <>
      <PageHeader
        title="Fields"
        description="Fields divide a farm into plots, so crops, activities and costs can be tracked per area."
        actions={
          farms.length > 0 && (
            <FormDialog trigger={<><Plus /> Add field</>} title="Add a field">
              <FieldForm farms={farms} />
            </FormDialog>
          )
        }
      />
      {fields.length === 0 ? (
        <EmptyState icon={Grid3x3} title="No fields yet" description={farms.length ? "Add a field to one of your farms." : "Create a farm first."} action={!farms.length ? <Link className="font-semibold text-forest-700" href="/farmer/farms/new">Add a farm</Link> : undefined} />
      ) : (
        <Card>
          <Table>
            <THead>
              <tr>
                <TH>Field</TH>
                <TH>Farm</TH>
                <TH>Area</TH>
                <TH>Soil</TH>
                <TH>Irrigation</TH>
                <TH>Current crop</TH>
                <TH>Planted</TH>
                <TH>Expected harvest</TH>
                <TH>Status</TH>
              </tr>
            </THead>
            <TBody>
              {fields.map((f) => {
                const c = f.cropRecords[0];
                return (
                  <TR key={f.id}>
                    <TD className="font-medium text-navy-900">{f.name}</TD>
                    <TD>
                      <Link href={`/farmer/farms/${f.farm.id}`} className="hover:text-forest-700">
                        {f.farm.name}
                      </Link>
                    </TD>
                    <TD>
                      {formatNumber(f.area.toString())} {f.areaUnit === "ACRES" ? "ac" : "ha"}
                    </TD>
                    <TD>{f.soilType ?? "—"}</TD>
                    <TD>{titleCase(f.irrigation)}</TD>
                    <TD>{c ? `${c.crop.name}${c.variety ? ` (${c.variety})` : ""}` : "—"}</TD>
                    <TD>{formatDate(c?.plantingDate)}</TD>
                    <TD>{formatDate(c?.expectedHarvestDate)}</TD>
                    <TD>
                      <StatusBadge status={f.status} />
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </Card>
      )}
    </>
  );
}
