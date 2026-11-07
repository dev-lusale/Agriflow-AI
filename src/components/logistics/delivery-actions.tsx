"use client";

import * as React from "react";
import type { DeliveryStatus } from "@prisma/client";
import { ActionButton, ActionForm, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/forms/action-form";
import { DELIVERY_STATUS_LABEL } from "@/lib/labels";
import { declineDeliveryAction, updateDeliveryAction } from "@/server/actions/ops";
import { cn } from "@/lib/utils";

const ACTION_LABEL: Partial<Record<DeliveryStatus, string>> = {
  ACCEPTED: "Accept job",
  PICKUP_SCHEDULED: "Schedule pickup",
  PICKED_UP: "Record pickup",
  IN_TRANSIT: "Mark in transit",
  DELIVERED: "Confirm delivery",
  CANCELLED: "Cancel delivery",
};

export function DeliveryActions({ deliveryId, next, vehicles, canDecline }: { deliveryId: string; next: DeliveryStatus[]; vehicles: { id: string; type: string; registration: string | null; capacityKg: number }[]; canDecline: boolean }) {
  const [status, setStatus] = React.useState<DeliveryStatus>(next.find((s) => s !== "CANCELLED") ?? next[0]!);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {next.map((s) => (
          <button key={s} type="button" onClick={() => setStatus(s)} className={cn("rounded-full px-3 py-1 text-xs font-medium ring-1", status === s ? (s === "CANCELLED" ? "bg-red-600 text-white ring-red-600" : "bg-forest-800 text-white ring-forest-800") : "bg-white text-navy-700 ring-border")}>
            {ACTION_LABEL[s] ?? DELIVERY_STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      <ActionForm key={status} action={updateDeliveryAction} className="space-y-3" confirm={status === "CANCELLED" ? "Cancel this delivery?" : undefined}>
        <input type="hidden" name="deliveryId" value={deliveryId} />
        <input type="hidden" name="status" value={status} />
        {status === "ACCEPTED" && (
          <>
            <TextField name="fee" label="Your fee (ZMW)" type="number" min={0} step="0.01" hint="Agree the fee with the requester before pickup." />
            {vehicles.length > 0 && <SelectField name="vehicleId" label="Vehicle" placeholder="Choose later" options={vehicles.map((v) => ({ value: v.id, label: `${v.type.replaceAll("_", " ").toLowerCase()} ${v.registration ?? ""} · ${v.capacityKg.toLocaleString()} kg` }))} />}
          </>
        )}
        {status === "PICKUP_SCHEDULED" && <TextField name="scheduledPickupAt" label="Pickup date" type="date" required />}
        {status === "DELIVERED" && (
          <>
            <TextField name="proofRecipient" label="Received by (name)" required />
            <TextAreaField name="proofNotes" label="Condition / notes" rows={2} />
            <div>
              <label htmlFor="proof" className="text-sm font-medium text-navy-700">
                Proof photo (optional)
              </label>
              <input id="proof" name="proof" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="mt-1.5 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-forest-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-forest-800" />
            </div>
          </>
        )}
        <TextAreaField name="note" label="Note (visible to all parties)" rows={2} />
        <SubmitButton variant={status === "CANCELLED" ? "danger" : "default"} className="w-full">
          {ACTION_LABEL[status] ?? "Update"}
        </SubmitButton>
      </ActionForm>
      {canDecline && (
        <ActionButton variant="ghost" className="w-full" promptNote="Reason for declining (optional):" action={(reason?: string) => declineDeliveryAction(deliveryId, reason)}>
          Decline this request
        </ActionButton>
      )}
    </div>
  );
}
