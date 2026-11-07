"use client";

import { ActionForm, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/forms/action-form";
import { LocationFields } from "@/components/forms/location-fields";
import { UNIT_LABEL, UNITS } from "@/lib/labels";
import { toDateInput } from "@/lib/utils";
import { addMarketPriceAction } from "@/server/actions/admin";

export function MarketPriceForm({ crops }: { crops: { id: string; name: string }[] }) {
  return (
    <ActionForm action={addMarketPriceAction} className="grid gap-4 sm:grid-cols-2" resetOnSuccess>
      <SelectField name="cropId" label="Crop" required options={crops.map((c) => ({ value: c.id, label: c.name }))} />
      <SelectField name="sourceType" label="Record type" required options={[{ value: "VERIFIED_OBSERVATION", label: "Verified market observation" }, { value: "HISTORICAL_RECORD", label: "Historical record" }, { value: "DEMO", label: "Demonstration data" }]} />
      <LocationFields required={false} labels={{ province: "Province", district: "District (optional)" }} />
      <TextField name="marketName" label="Market name" placeholder="e.g. Soweto Market, Lusaka" />
      <TextField name="observedOn" label="Observation date" type="date" required defaultValue={toDateInput(new Date())} />
      <TextField name="price" label="Price (ZMW)" type="number" step="0.01" min={0} required />
      <SelectField name="unit" label="Unit" required defaultValue="BAG_50KG" options={UNITS.map((u) => ({ value: u, label: UNIT_LABEL[u] }))} />
      <TextField name="sourceName" label="Source" required className="sm:col-span-2" placeholder="Who collected it / publication and date" />
      <TextAreaField name="notes" label="Notes" rows={2} className="sm:col-span-2" />
      <div className="sm:col-span-2">
        <SubmitButton>Save record</SubmitButton>
      </div>
    </ActionForm>
  );
}
