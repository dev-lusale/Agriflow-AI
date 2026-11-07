import type { Metadata } from "next";
import { Plus, Tractor } from "lucide-react";
import { Badge, Card } from "@/components/ui/primitives";
import { EmptyState, PageHeader } from "@/components/layout/page";
import { FormDialog } from "@/components/forms/form-dialog";
import { ActionButton } from "@/components/forms/action-form";
import { VehicleForm } from "@/components/logistics/vehicle-form";
import { requirePageRole } from "@/lib/auth/session";
import { titleCase } from "@/lib/utils";
import { listVehicles } from "@/server/logistics/service";
import { setVehicleActiveAction } from "@/server/actions/ops";

export const metadata: Metadata = { title: "Vehicles" };

export default async function VehiclesPage() {
  const user = await requirePageRole("TRANSPORTER");
  const vehicles = await listVehicles({ id: user.id, role: user.role });
  return (
    <>
      <PageHeader
        title="Vehicles"
        description="Your fleet and carrying capacity. Assign a vehicle when you accept a job."
        actions={
          <FormDialog trigger={<><Plus /> Add vehicle</>} title="Add a vehicle">
            <VehicleForm />
          </FormDialog>
        }
      />
      {vehicles.length === 0 ? (
        <EmptyState icon={Tractor} title="No vehicles yet" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((v) => (
            <Card key={v.id} className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex size-11 items-center justify-center rounded-xl bg-forest-50 text-forest-700">
                  <Tractor className="size-5" />
                </div>
                <Badge tone={v.isActive ? "green" : "slate"}>{v.isActive ? "Active" : "Inactive"}</Badge>
              </div>
              <p className="mt-3 font-semibold">{titleCase(v.type)}</p>
              <p className="text-sm text-navy-500">{v.registration ?? "No registration recorded"}</p>
              <p className="mt-2 text-sm">
                Capacity <span className="font-semibold">{v.capacityKg.toLocaleString()} kg</span> · {v._count.deliveries} deliveries
              </p>
              {v.description && <p className="mt-1 text-xs text-navy-500">{v.description}</p>}
              <ActionButton size="sm" variant="outline" className="mt-4" action={async () => { "use server"; return setVehicleActiveAction(v.id, !v.isActive); }}>
                {v.isActive ? "Deactivate" : "Activate"}
              </ActionButton>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
