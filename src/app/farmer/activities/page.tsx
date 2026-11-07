import type { Metadata } from "next";
import Link from "next/link";
import { ListChecks, Plus, Trash2, WifiOff } from "lucide-react";
import { Badge, Card, Table, THead, TBody, TR, TH, TD } from "@/components/ui/primitives";
import { EmptyState, PageHeader } from "@/components/layout/page";
import { FormDialog } from "@/components/forms/form-dialog";
import { ActionButton } from "@/components/forms/action-form";
import { ActivityForm } from "@/components/farm/forms";
import { requirePageRole } from "@/lib/auth/session";
import { ACTIVITY_LABEL } from "@/lib/labels";
import { formatZMW } from "@/lib/money";
import { formatDate, formatNumber } from "@/lib/utils";
import { listActivities } from "@/server/farms/service";
import { farmOptions } from "@/server/farms/options";
import { deleteActivityAction } from "@/server/actions/farm";

export const metadata: Metadata = { title: "Farm activities" };

export default async function ActivitiesPage({ searchParams }: { searchParams: Promise<{ new?: string; farm?: string }> }) {
  const sp = await searchParams;
  const user = await requirePageRole("FARMER");
  const [activities, opts] = await Promise.all([listActivities({ id: user.id, role: user.role }, { farmId: sp.farm }), farmOptions(user.id)]);
  return (
    <>
      <PageHeader
        title="Farm activities"
        description="Land preparation, planting, fertilizer, irrigation, weeding, spraying, harvest and storage, with quantities and costs."
        actions={
          <>
            <Link href="/offline" className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-600 hover:text-forest-700">
              <WifiOff className="size-4" /> Offline records
            </Link>
            {opts.length > 0 && (
              <FormDialog trigger={<><Plus /> Record activity</>} title="Record a farm activity" description="Works offline too: it will sync when you reconnect." wide defaultOpen={sp.new === "1"}>
                <ActivityForm farms={opts} />
              </FormDialog>
            )}
          </>
        }
      />
      {opts.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          <a href="?" className={`rounded-full px-3 py-1.5 font-medium ring-1 ${!sp.farm ? "bg-forest-800 text-white ring-forest-800" : "bg-white text-navy-700 ring-border"}`}>
            All farms
          </a>
          {opts.map((f) => (
            <a key={f.id} href={`?farm=${f.id}`} className={`rounded-full px-3 py-1.5 font-medium ring-1 ${sp.farm === f.id ? "bg-forest-800 text-white ring-forest-800" : "bg-white text-navy-700 ring-border"}`}>
              {f.name}
            </a>
          ))}
        </div>
      )}
      {activities.length === 0 ? (
        <EmptyState icon={ListChecks} title="No activities recorded" description="Record what you do on the farm to build a history and track costs." />
      ) : (
        <Card>
          <Table>
            <THead>
              <tr>
                <TH>Date</TH>
                <TH>Activity</TH>
                <TH>Farm / field</TH>
                <TH>Crop</TH>
                <TH>Quantity</TH>
                <TH>Cost</TH>
                <TH>Notes</TH>
                <TH />
              </tr>
            </THead>
            <TBody>
              {activities.map((a) => (
                <TR key={a.id}>
                  <TD className="whitespace-nowrap">{formatDate(a.date)}</TD>
                  <TD className="font-medium text-navy-900">
                    {ACTIVITY_LABEL[a.type]}
                    {a.clientId && <Badge tone="blue" className="ml-1.5">synced from offline</Badge>}
                  </TD>
                  <TD>
                    {a.farm.name}
                    {a.field && <p className="text-xs text-navy-500">{a.field.name}</p>}
                  </TD>
                  <TD>{a.cropRecord?.crop.name ?? "—"}</TD>
                  <TD>{a.quantity ? `${formatNumber(a.quantity.toString())} ${a.unit ?? ""}` : "—"}</TD>
                  <TD className="whitespace-nowrap">
                    {a.cost ? formatZMW(a.cost) : "—"}
                    {a.transaction && <p className="text-[11px] text-forest-700">in finances</p>}
                  </TD>
                  <TD className="max-w-xs truncate text-xs">{a.notes ?? ""}</TD>
                  <TD>
                    <ActionButton size="icon-sm" variant="ghost" aria-label="Delete activity" action={async () => { "use server"; return deleteActivityAction(a.id); }} confirm="Delete this activity (and its linked expense)?">
                      <Trash2 />
                    </ActionButton>
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
