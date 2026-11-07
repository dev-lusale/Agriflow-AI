"use client";

import { ActionForm, SelectField, SubmitButton, TextField } from "@/components/forms/action-form";
import { addVehicleAction } from "@/server/actions/ops";

const TYPES = ["PICKUP", "LIGHT_TRUCK", "MEDIUM_TRUCK", "HEAVY_TRUCK", "REFRIGERATED_TRUCK", "TRACTOR_TRAILER", "MOTORBIKE"];

export function VehicleForm() {
  return (
    <ActionForm action={addVehicleAction} className="grid gap-4 sm:grid-cols-2">
      <SelectField name="type" label="Vehicle type" required options={TYPES.map((t) => ({ value: t, label: t.replaceAll("_", " ").toLowerCase().replace(/^./, (s) => s.toUpperCase()) }))} />
      <TextField name="registration" label="Registration" placeholder="e.g. ABC 1234" />
      <TextField name="capacityKg" label="Capacity (kg)" type="number" min={1} required />
      <TextField name="description" label="Description" placeholder="Tarpaulin, cooling…" />
      <div className="sm:col-span-2">
        <SubmitButton>Add vehicle</SubmitButton>
      </div>
    </ActionForm>
  );
}
