"use client";

import { ActionForm, SubmitButton, TextAreaField, TextField } from "@/components/forms/action-form";
import { LocationFields } from "@/components/forms/location-fields";
import { requestDeliveryAction } from "@/server/actions/ops";

type Loc = { province: string | null; district: string | null };

export function DeliveryRequestForm({ orderId, cargo, pickup, dropoff }: { orderId?: string; cargo?: string; pickup?: Loc; dropoff?: Loc }) {
  return (
    <ActionForm action={requestDeliveryAction} className="grid gap-4 sm:grid-cols-2">
      {orderId && <input type="hidden" name="orderId" value={orderId} />}
      <TextField name="cargoDescription" label="What needs moving?" required defaultValue={cargo} className="sm:col-span-2" />
      <TextField name="weightKg" label="Approx. weight (kg)" type="number" min={1} inputMode="numeric" />
      <TextField name="expectedDate" label="Needed by" type="date" />
      <p className="text-sm font-semibold text-navy-800 sm:col-span-2">Pickup</p>
      <LocationFields provinceName="pickupProvince" districtName="pickupDistrict" defaultProvince={pickup?.province} defaultDistrict={pickup?.district} labels={{ province: "Pickup province", district: "Pickup district" }} />
      <TextField name="pickupLocation" label="Pickup address / directions" required className="sm:col-span-2" />
      <p className="text-sm font-semibold text-navy-800 sm:col-span-2">Delivery</p>
      <LocationFields provinceName="dropoffProvince" districtName="dropoffDistrict" defaultProvince={dropoff?.province} defaultDistrict={dropoff?.district} labels={{ province: "Delivery province", district: "Delivery district" }} />
      <TextField name="dropoffLocation" label="Delivery address" required className="sm:col-span-2" />
      <TextAreaField name="notes" label="Notes for the transporter" rows={2} className="sm:col-span-2" />
      <div className="sm:col-span-2">
        <SubmitButton>Request transport</SubmitButton>
      </div>
    </ActionForm>
  );
}
