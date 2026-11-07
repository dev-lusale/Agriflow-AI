"use client";

import { ActionForm, SelectField, SubmitButton, TextAreaField, TextField, FormError } from "@/components/forms/action-form";
import { LocationFields } from "@/components/forms/location-fields";
import { onboardingAction } from "@/server/auth/actions";
import { PROVINCES } from "@/lib/zambia";

type Props = {
  role: "FARMER" | "BUYER" | "SUPPLIER" | "TRANSPORTER";
  defaults: { fullName: string; phone: string; province: string | null; district: string | null };
  crops: string[];
  categories: string[];
};

function ChipGroup({ name, options, label }: { name: string; options: (string | { value: string; label: string })[]; label: string }) {
  return (
    <fieldset className="sm:col-span-2">
      <legend className="mb-2 text-sm font-medium text-navy-700">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((raw) => { const o = typeof raw === "string" ? { value: raw, label: raw } : raw; return (
          <label key={o.value} className="cursor-pointer">
            <input type="checkbox" name={`${name}[]`} value={o.value} className="peer sr-only" />
            <span className="inline-block rounded-full border border-border bg-white px-3 py-1.5 text-sm text-navy-700 transition peer-checked:border-forest-500 peer-checked:bg-forest-50 peer-checked:font-medium peer-checked:text-forest-800 peer-focus-visible:ring-2 peer-focus-visible:ring-forest-500">
              {o.label}
            </span>
          </label>
        ); })}
      </div>
      <FormError name={name} />
    </fieldset>
  );
}

const FARMING_TYPES = [
  { value: "SMALLHOLDER", label: "Smallholder" },
  { value: "EMERGENT", label: "Emergent / medium-scale" },
  { value: "COMMERCIAL", label: "Commercial" },
  { value: "COOPERATIVE", label: "Cooperative member" },
  { value: "ORGANIC", label: "Organic" },
  { value: "MIXED", label: "Mixed crop & livestock" },
];

export function OnboardingForm({ role, defaults, crops, categories }: Props) {
  return (
    <ActionForm action={onboardingAction} className="grid gap-4 sm:grid-cols-2" refresh={false}>
      <TextField name="fullName" label="Full name" defaultValue={defaults.fullName} required />
      <TextField name="phone" label="Phone number" type="tel" defaultValue={defaults.phone} placeholder="+260 97 1234567" hint="Optional" />
      <LocationFields defaultProvince={defaults.province} defaultDistrict={defaults.district} />

      {role === "FARMER" && (
        <>
          <TextField name="experienceYears" label="Years of farming experience" type="number" min={0} max={80} inputMode="numeric" />
          <SelectField name="farmingType" label="Farming type" required options={FARMING_TYPES} defaultValue="SMALLHOLDER" />
          <ChipGroup name="mainCrops" label="Main crops" options={crops} />
          <div className="rounded-xl bg-forest-50 p-4 sm:col-span-2">
            <p className="text-sm font-semibold text-forest-800">Your first farm (optional)</p>
            <p className="text-xs text-forest-700">Add it now or later from Farms. It uses the province and district above.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <TextField name="farmName" label="Farm name" placeholder="e.g. Mwale Family Farm" />
              <TextField name="farmSize" label="Farm size" type="number" step="0.01" min={0} inputMode="decimal" />
              <SelectField name="sizeUnit" label="Unit" options={[{ value: "HECTARES", label: "Hectares" }, { value: "ACRES", label: "Acres" }]} />
            </div>
          </div>
        </>
      )}

      {role === "BUYER" && (
        <>
          <TextField name="businessName" label="Business name" hint="Optional for individual buyers" />
          <SelectField
            name="buyerType"
            label="Buyer type"
            placeholder="Select"
            options={["Trader", "Processor / miller", "Retailer", "Exporter", "Institution (school, hospital)", "Individual"].map((v) => ({ value: v, label: v }))}
          />
          <ChipGroup name="preferredCrops" label="Produce you buy" options={crops} />
        </>
      )}

      {role === "SUPPLIER" && (
        <>
          <TextField name="businessName" label="Business name" required />
          <TextField name="registrationNumber" label="Business registration no." hint="Optional (e.g. PACRA number)" />
          <TextAreaField name="description" label="About your business" className="sm:col-span-2" rows={3} />
          <ChipGroup name="categories" label="Product categories" options={categories} />
        </>
      )}

      {role === "TRANSPORTER" && (
        <>
          <TextField name="businessName" label="Business / trading name" required />
          <TextField name="contactPhone" label="Dispatch phone" type="tel" placeholder="+260 …" />
          <SelectField
            name="pricingModel"
            label="Pricing model"
            options={[
              { value: "NEGOTIABLE", label: "Negotiable per job" },
              { value: "PER_KM", label: "Per kilometre" },
              { value: "PER_TONNE", label: "Per tonne" },
              { value: "PER_TRIP", label: "Per trip" },
            ]}
          />
          <TextField name="baseRate" label="Base rate (ZMW)" type="number" min={0} step="0.01" hint="Optional" />
          <ChipGroup name="serviceProvinces" label="Provinces you serve" options={PROVINCES} />
        </>
      )}

      <div className="sm:col-span-2">
        <SubmitButton size="lg" className="w-full sm:w-auto">
          Save and continue
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
