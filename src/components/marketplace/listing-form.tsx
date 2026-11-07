"use client";

import * as React from "react";
import { ActionForm, SelectField, SubmitButton, TextAreaField, TextField, type ServerAction } from "@/components/forms/action-form";
import { LocationFields } from "@/components/forms/location-fields";
import { UNIT_LABEL, UNITS } from "@/lib/labels";
import { toDateInput } from "@/lib/utils";
import { createListingAction, updateListingAction } from "@/server/actions/market";

export type ListingDefaults = {
  id: string;
  cropId: string;
  farmId: string | null;
  title: string;
  variety: string | null;
  totalQuantity: string;
  unit: string;
  pricePerUnit: string;
  minOrderQuantity: string | null;
  province: string;
  district: string;
  pickupLocation: string | null;
  qualityGrade: string;
  harvestDate: string | null;
  description: string | null;
  status: string;
};

export function ListingForm({ crops, farms, listing, defaults }: { crops: { id: string; name: string; defaultUnit: string }[]; farms: { id: string; name: string; province: string; district: string }[]; listing?: ListingDefaults; defaults?: { province?: string | null; district?: string | null } }) {
  const [cropId, setCropId] = React.useState(listing?.cropId ?? crops.find((c) => c.name === "Maize")?.id ?? crops[0]?.id ?? "");
  const crop = crops.find((c) => c.id === cropId);
  const action: ServerAction<unknown> = listing ? updateListingAction.bind(null, listing.id) : createListingAction;
  const farm0 = farms[0];
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2">
      <SelectField name="cropId" label="Crop type" required value={cropId} onChange={(e) => setCropId(e.target.value)} options={crops.map((c) => ({ value: c.id, label: c.name }))} />
      <SelectField name="farmId" label="From farm" defaultValue={listing?.farmId ?? farm0?.id ?? ""} placeholder="Not linked to a farm" options={farms.map((f) => ({ value: f.id, label: f.name }))} />
      <TextField name="title" label="Produce name" required defaultValue={listing?.title ?? (crop ? `${crop.name}` : "")} className="sm:col-span-2" placeholder="e.g. White maize, sun-dried, 50 kg bags" />
      <TextField name="variety" label="Variety" defaultValue={listing?.variety ?? ""} />
      <SelectField name="qualityGrade" label="Quality grade" defaultValue={listing?.qualityGrade ?? "UNGRADED"} options={[{ value: "GRADE_A", label: "Grade A" }, { value: "GRADE_B", label: "Grade B" }, { value: "GRADE_C", label: "Grade C" }, { value: "UNGRADED", label: "Ungraded" }]} />
      <TextField name="quantity" label={listing ? "Total quantity (incl. sold)" : "Quantity available"} type="number" step="0.01" min={0} required defaultValue={listing?.totalQuantity} />
      <SelectField key={cropId} name="unit" label="Unit" required defaultValue={listing?.unit ?? crop?.defaultUnit ?? "KG"} options={UNITS.map((u) => ({ value: u, label: UNIT_LABEL[u] }))} />
      <TextField name="pricePerUnit" label="Price per unit (ZMW)" type="number" step="0.01" min={0} required defaultValue={listing?.pricePerUnit} inputMode="decimal" />
      <TextField name="minOrderQuantity" label="Minimum order (optional)" type="number" step="0.01" min={0} defaultValue={listing?.minOrderQuantity ?? ""} />
      <LocationFields defaultProvince={listing?.province ?? defaults?.province ?? farm0?.province} defaultDistrict={listing?.district ?? defaults?.district ?? farm0?.district} />
      <TextField name="pickupLocation" label="Pickup location" defaultValue={listing?.pickupLocation ?? ""} className="sm:col-span-2" />
      <TextField name="harvestDate" label="Harvest date" type="date" defaultValue={toDateInput(listing?.harvestDate)} />
      <SelectField name="status" label="Visibility" defaultValue={listing?.status === "INACTIVE" ? "INACTIVE" : "ACTIVE"} options={[{ value: "ACTIVE", label: "Published" }, { value: "INACTIVE", label: "Paused (hidden)" }]} />
      <TextAreaField name="description" label="Description" defaultValue={listing?.description ?? ""} className="sm:col-span-2" rows={3} placeholder="Moisture, cleanliness, packaging, storage, inspection…" />
      {!listing && (
        <div className="sm:col-span-2">
          <label className="text-sm font-medium text-navy-700" htmlFor="photos">
            Photos (up to 4, JPEG/PNG/WebP, max 5 MB each)
          </label>
          <input id="photos" name="photos" type="file" multiple accept="image/jpeg,image/png,image/webp" className="mt-1.5 block w-full text-sm text-navy-600 file:mr-3 file:rounded-lg file:border-0 file:bg-forest-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-forest-800" />
        </div>
      )}
      <div className="sm:col-span-2">
        <SubmitButton>{listing ? "Save listing" : "Publish listing"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
