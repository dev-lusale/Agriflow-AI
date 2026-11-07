import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Grid3x3, ListChecks, MapPin, Pencil, Plus, Sprout, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Badge, Table, THead, TBody, TR, TH, TD } from "@/components/ui/primitives";
import { KeyValue, PageHeader, StatusBadge } from "@/components/layout/page";
import { FormDialog } from "@/components/forms/form-dialog";
import { ActionButton } from "@/components/forms/action-form";
import { ActivityForm, CropRecordForm, FarmForm, FieldForm } from "@/components/farm/forms";
import { WeatherCard, WeatherCardSkeleton } from "@/components/weather/weather-card";
import { TaskCheck } from "@/components/farm/task-check";
import { requirePageRole } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { provinceLabel } from "@/lib/zambia";
import { ACTIVITY_LABEL, GROWTH_STAGE_LABEL, UNIT_LABEL } from "@/lib/labels";
import { formatDate, formatNumber, titleCase } from "@/lib/utils";
import { formatZMW } from "@/lib/money";
import { getFarmDetail } from "@/server/farms/service";
import { cropCatalog, farmOptions } from "@/server/farms/options";
import { deleteFarmAction, deleteFieldAction } from "@/server/actions/farm";

export const metadata: Metadata = { title: "Farm" };

export default async function FarmDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageRole("FARMER");
  const actor = { id: user.id, role: user.role };
  let farm;
  try {
    farm = await getFarmDetail(actor, id);
  } catch (e) {
    if (e instanceof AppError) notFound();
    throw e;
  }
  const [opts, crops] = await Promise.all([farmOptions(user.id), cropCatalog()]);
  const plainFarms = opts.map((f) => ({ id: f.id, name: f.name }));

  return (
    <>
      <PageHeader
        back={{ href: "/farmer/farms", label: "Farms" }}
        title={farm.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <MapPin className="size-4" /> {farm.district}, {provinceLabel(farm.province)} · {formatNumber(farm.size.toString())} {farm.sizeUnit.toLowerCase()} · {titleCase(farm.farmingType)}
          </span>
        }
        actions={
          <>
            <FormDialog trigger={<><ListChecks /> Record activity</>} title="Record a farm activity" variant="outline" wide>
              <ActivityForm farms={opts} defaultFarmId={farm.id} />
            </FormDialog>
            <FormDialog trigger={<><Pencil /> Edit</>} title="Edit farm" variant="outline" wide>
                              <FarmForm
                  farm={{
                    id: farm.id,
                    name: farm.name,
                    province: farm.province,
                    district: farm.district,
                    location: farm.location,
                    size: farm.size.toString(),
                    sizeUnit: farm.sizeUnit,
                    description: farm.description,
                    farmingType: farm.farmingType,
                    latitude: farm.latitude?.toString() ?? null,
                    longitude: farm.longitude?.toString() ?? null,
                  }}
                />
            </FormDialog>
            <ActionButton variant="danger-outline" action={async () => { "use server"; return deleteFarmAction(farm.id); }} confirm={`Delete ${farm.name}? Fields, crops and activities on this farm will also be deleted.`}>
              <Trash2 />
            </ActionButton>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Grid3x3 className="size-4 text-forest-600" /> Fields
              </CardTitle>
              <FormDialog trigger={<><Plus /> Add field</>} title="Add a field" size="sm" variant="secondary">
                <FieldForm farms={[{ id: farm.id, name: farm.name }]} />
              </FormDialog>
            </CardHeader>
            <CardContent>
              {farm.fields.length === 0 ? (
                <p className="text-sm text-navy-500">No fields yet. Fields let you track crops and costs per plot.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {farm.fields.map((f) => (
                    <div key={f.id} className="rounded-xl border border-border p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">{f.name}</p>
                          <p className="text-xs text-navy-500">
                            {formatNumber(f.area.toString())} {f.areaUnit.toLowerCase()} · {titleCase(f.irrigation)}
                            {f.soilType ? ` · ${f.soilType}` : ""}
                          </p>
                        </div>
                        <StatusBadge status={f.status} />
                      </div>
                      <p className="mt-2 text-sm text-navy-700">
                        {f.cropRecords.length ? f.cropRecords.map((c) => `${c.crop.name}${c.plantingDate ? ` (planted ${formatDate(c.plantingDate, { day: "numeric", month: "short" })})` : ""}`).join(", ") : "No current crop"}
                      </p>
                      <div className="mt-3 flex gap-2">
                        <FormDialog trigger={<><Pencil /> Edit</>} title="Edit field" size="sm" variant="ghost">
                                                      <FieldForm
                              farms={plainFarms}
                              field={{ id: f.id, farmId: farm.id, name: f.name, area: f.area.toString(), areaUnit: f.areaUnit, soilType: f.soilType, irrigation: f.irrigation, status: f.status, notes: f.notes }}
                            />
                        </FormDialog>
                        <ActionButton size="sm" variant="ghost" action={async () => { "use server"; return deleteFieldAction(f.id); }} confirm={`Remove ${f.name}?`}>
                          <Trash2 /> Remove
                        </ActionButton>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Sprout className="size-4 text-forest-600" /> Crops
              </CardTitle>
              <FormDialog trigger={<><Plus /> Add crop</>} title="Add a crop record" size="sm" variant="secondary" wide>
                <CropRecordForm farms={opts} crops={crops} defaultFarmId={farm.id} />
              </FormDialog>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <THead>
                  <tr>
                    <TH>Crop</TH>
                    <TH>Field</TH>
                    <TH>Planted</TH>
                    <TH>Stage</TH>
                    <TH>Yield</TH>
                  </tr>
                </THead>
                <TBody>
                  {farm.cropRecords.map((c) => (
                    <TR key={c.id}>
                      <TD>
                        <Link href={`/farmer/crops#${c.id}`} className="font-medium text-navy-900 hover:text-forest-700">
                          {c.crop.name}
                        </Link>
                        {c.variety && <p className="text-xs text-navy-500">{c.variety}</p>}
                      </TD>
                      <TD>{c.field?.name ?? "—"}</TD>
                      <TD>{formatDate(c.plantingDate)}</TD>
                      <TD>
                        <StatusBadge status={c.status} label={GROWTH_STAGE_LABEL[c.growthStage]} />
                      </TD>
                      <TD className="text-xs">
                        {c.actualHarvest ? `${formatNumber(c.actualHarvest.toString())} ${UNIT_LABEL[c.yieldUnit]} (actual)` : c.estimatedYield ? `${formatNumber(c.estimatedYield.toString())} ${UNIT_LABEL[c.yieldUnit]} (est.)` : "—"}
                      </TD>
                    </TR>
                  ))}
                  {farm.cropRecords.length === 0 && (
                    <TR>
                      <TD colSpan={5} className="text-center text-navy-500">
                        No crops recorded on this farm.
                      </TD>
                    </TR>
                  )}
                </TBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Recent activities</CardTitle>
              <Link href="/farmer/activities" className="text-xs font-semibold text-forest-700 hover:underline">
                All activities
              </Link>
            </CardHeader>
            <CardContent>
              {farm.activities.length ? (
                <ul className="divide-y divide-border">
                  {farm.activities.map((a) => (
                    <li key={a.id} className="flex justify-between gap-3 py-2.5 text-sm">
                      <div>
                        <p className="font-medium">{ACTIVITY_LABEL[a.type]}</p>
                        <p className="text-xs text-navy-500">
                          {[a.field?.name, a.cropRecord?.crop.name, a.notes?.slice(0, 80)].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <div className="shrink-0 text-right text-xs text-navy-500">
                        {formatDate(a.date)}
                        {a.cost && <p className="font-medium text-navy-700">{formatZMW(a.cost)}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-navy-500">No activities yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Suspense fallback={<WeatherCardSkeleton />}>
            <WeatherCard actor={actor} farmId={farm.id} farmName={farm.name} />
          </Suspense>
          <Card>
            <CardHeader>
              <CardTitle>Farm details</CardTitle>
            </CardHeader>
            <CardContent>
              <KeyValue
                className="sm:grid-cols-1"
                items={[
                  ["Location", farm.location ?? "—"],
                  ["GPS", farm.latitude ? `${farm.latitude.toString()}, ${farm.longitude?.toString()}` : <Badge tone="slate">Not provided</Badge>],
                  ["Description", farm.description ?? "—"],
                  ["Registered", formatDate(farm.createdAt)],
                ]}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Open tasks</CardTitle>
            </CardHeader>
            <CardContent>
              {farm.tasks.length ? (
                <ul className="space-y-2">
                  {farm.tasks.map((t) => (
                    <li key={t.id} className="flex gap-3 text-sm">
                      <TaskCheck id={t.id} done={false} title={t.title} />
                      <div>
                        <p className="font-medium">{t.title}</p>
                        <p className="text-xs text-navy-500">{formatDate(t.dueDate)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-navy-500">No open tasks.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
