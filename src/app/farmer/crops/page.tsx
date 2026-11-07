import type { Metadata } from "next";
import { Plus, Sprout, Trash2, Pencil } from "lucide-react";
import { Card, Table, THead, TBody, TR, TH, TD } from "@/components/ui/primitives";
import { EmptyState, PageHeader, StatusBadge } from "@/components/layout/page";
import { FormDialog } from "@/components/forms/form-dialog";
import { ActionButton } from "@/components/forms/action-form";
import { CropRecordForm } from "@/components/farm/forms";
import { CropAdvisorButton } from "@/components/ai/crop-advisor";
import { requirePageRole } from "@/lib/auth/session";
import { GROWTH_STAGE_LABEL, UNIT_LABEL } from "@/lib/labels";
import { formatDate, formatNumber, toDateInput } from "@/lib/utils";
import { listCropRecords } from "@/server/farms/service";
import { cropCatalog, farmOptions } from "@/server/farms/options";
import { deleteCropRecordAction } from "@/server/actions/farm";

export const metadata: Metadata = { title: "Crops" };

export default async function CropsPage({ searchParams }: { searchParams: Promise<{ new?: string; status?: string }> }) {
  const sp = await searchParams;
  const user = await requirePageRole("FARMER");
  const [records, opts, crops] = await Promise.all([listCropRecords({ id: user.id, role: user.role }, { status: sp.status }), farmOptions(user.id), cropCatalog()]);
  return (
    <>
      <PageHeader
        title="Crops"
        description="Every crop record: variety, planting, growth stage, yield and harvest. Ask Grok for advice on any active crop."
        actions={
          opts.length > 0 && (
            <FormDialog trigger={<><Plus /> Add crop</>} title="Add a crop record" wide defaultOpen={sp.new === "1"}>
              <CropRecordForm farms={opts} crops={crops} />
            </FormDialog>
          )
        }
      />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {[
          ["", "All"],
          ["GROWING", "Growing"],
          ["PLANNED", "Planned"],
          ["HARVESTED", "Harvested"],
          ["FAILED", "Failed"],
        ].map(([v, l]) => (
          <a key={v} href={v ? `?status=${v}` : "?"} className={`rounded-full px-3.5 py-1.5 font-medium ring-1 transition-colors ${(sp.status ?? "") === v ? "bg-ink text-white ring-ink shadow-sm" : "bg-white/80 text-navy-700 ring-black/5 hover:bg-white"}`}>
            {l}
          </a>
        ))}
      </div>
      {records.length === 0 ? (
        <EmptyState icon={Sprout} title="No crop records" description={opts.length ? "Add a crop to track its growth and harvest." : "Create a farm first, then add crops."} />
      ) : (
        <Card>
          <Table>
            <THead>
              <tr>
                <TH>Crop</TH>
                <TH>Farm / field</TH>
                <TH>Planted</TH>
                <TH>Expected harvest</TH>
                <TH>Stage</TH>
                <TH>Estimated</TH>
                <TH>Actual</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {records.map((r) => (
                <TR key={r.id} id={r.id}>
                  <TD>
                    <p className="font-medium text-navy-900">{r.crop.name}</p>
                    <p className="text-xs text-navy-500">{r.variety ?? "Variety not set"}</p>
                  </TD>
                  <TD>
                    {r.farm.name}
                    <p className="text-xs text-navy-500">{r.field?.name ?? "—"}</p>
                  </TD>
                  <TD>{formatDate(r.plantingDate)}</TD>
                  <TD>{formatDate(r.expectedHarvestDate)}</TD>
                  <TD>
                    <StatusBadge status={r.status} label={GROWTH_STAGE_LABEL[r.growthStage]} />
                  </TD>
                  <TD>{r.estimatedYield ? `${formatNumber(r.estimatedYield.toString())} ${UNIT_LABEL[r.yieldUnit]}` : "—"}</TD>
                  <TD>{r.actualHarvest ? `${formatNumber(r.actualHarvest.toString())} ${UNIT_LABEL[r.yieldUnit]}` : "—"}</TD>
                  <TD>
                    <div className="flex justify-end gap-1">
                      {(r.status === "GROWING" || r.status === "PLANNED") && <CropAdvisorButton cropRecordId={r.id} label={`${r.crop.name}, ${r.farm.name}`} />}
                      <FormDialog trigger={<Pencil />} title={`Edit ${r.crop.name}`} size="icon-sm" variant="ghost" wide>
                        <CropRecordForm
                          farms={opts}
                          crops={crops}
                          record={{
                            id: r.id,
                            farmId: r.farmId,
                            fieldId: r.fieldId,
                            cropId: r.cropId,
                            variety: r.variety,
                            areaPlanted: r.areaPlanted?.toString() ?? null,
                            plantingDate: toDateInput(r.plantingDate) || null,
                            expectedHarvestDate: toDateInput(r.expectedHarvestDate) || null,
                            growthStage: r.growthStage,
                            estimatedYield: r.estimatedYield?.toString() ?? null,
                            actualHarvest: r.actualHarvest?.toString() ?? null,
                            yieldUnit: r.yieldUnit,
                            status: r.status,
                            notes: r.notes,
                          }}
                        />
                      </FormDialog>
                      <ActionButton size="icon-sm" variant="ghost" aria-label="Delete" action={async () => { "use server"; return deleteCropRecordAction(r.id); }} confirm={`Delete the ${r.crop.name} record?`}>
                        <Trash2 />
                      </ActionButton>
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
