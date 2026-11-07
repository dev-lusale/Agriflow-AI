"use client";

import * as React from "react";
import { toast } from "sonner";
import { ActionForm, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/forms/action-form";
import { LocationFields } from "@/components/forms/location-fields";
import { Checkbox } from "@/components/ui/primitives";
import { ACTIVITY_LABEL, ACTIVITY_TYPES, GROWTH_STAGE_LABEL, UNIT_LABEL, UNITS } from "@/lib/labels";
import { toDateInput } from "@/lib/utils";
import { enqueue } from "@/lib/offline/queue";
import { createCropRecordAction, createFarmAction, createFieldAction, createTaskAction, recordActivityAction, updateCropRecordAction, updateFarmAction, updateFieldAction } from "@/server/actions/farm";

export type FarmOpt = { id: string; name: string; fields: { id: string; name: string }[]; crops: { id: string; label: string }[] };
const FARMING_TYPES = ["SMALLHOLDER", "EMERGENT", "COMMERCIAL", "COOPERATIVE", "ORGANIC", "MIXED"].map((v) => ({ value: v, label: v[0] + v.slice(1).toLowerCase() }));

// ───────── Farm ─────────
export type FarmDefaults = {
  id?: string;
  name?: string;
  province?: string;
  district?: string;
  location?: string | null;
  size?: string;
  sizeUnit?: string;
  description?: string | null;
  farmingType?: string;
  latitude?: string | null;
  longitude?: string | null;
};

export function FarmForm({ farm, onDone }: { farm?: FarmDefaults; onDone?: () => void }) {
  const action = farm?.id ? updateFarmAction.bind(null, farm.id) : createFarmAction;
  const gpsRef = React.useRef<{ lat: HTMLInputElement | null; lng: HTMLInputElement | null }>({ lat: null, lng: null });
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2" onSuccess={onDone}>
      <TextField name="name" label="Farm name" required defaultValue={farm?.name} className="sm:col-span-2" />
      <LocationFields defaultProvince={farm?.province} defaultDistrict={farm?.district} />
      <TextField name="location" label="Location / directions" defaultValue={farm?.location ?? ""} className="sm:col-span-2" placeholder="e.g. 12 km on Choma–Namwala road" />
      <TextField name="size" label="Farm size" type="number" step="0.01" min={0} required defaultValue={farm?.size} inputMode="decimal" />
      <SelectField name="sizeUnit" label="Unit" defaultValue={farm?.sizeUnit ?? "HECTARES"} options={[{ value: "HECTARES", label: "Hectares" }, { value: "ACRES", label: "Acres" }]} />
      <SelectField name="farmingType" label="Farming type" defaultValue={farm?.farmingType ?? "SMALLHOLDER"} options={FARMING_TYPES} />
      <div className="sm:col-span-2">
        <p className="text-sm font-medium text-navy-700">GPS coordinates (optional)</p>
        <p className="text-xs text-navy-500">Only add these if you are at the farm or know them. We never guess coordinates.</p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <TextField name="latitude" label="Latitude" type="number" step="0.000001" defaultValue={farm?.latitude ?? ""} placeholder="-16.8065" ref={(el) => void (gpsRef.current.lat = el)} />
          <TextField name="longitude" label="Longitude" type="number" step="0.000001" defaultValue={farm?.longitude ?? ""} placeholder="26.9531" ref={(el) => void (gpsRef.current.lng = el)} />
        </div>
        <button
          type="button"
          className="mt-2 text-xs font-semibold text-forest-700 hover:underline"
          onClick={() => {
            if (!navigator.geolocation) return toast.error("Location is not available on this device.");
            navigator.geolocation.getCurrentPosition(
              (p) => {
                if (gpsRef.current.lat) gpsRef.current.lat.value = p.coords.latitude.toFixed(6);
                if (gpsRef.current.lng) gpsRef.current.lng.value = p.coords.longitude.toFixed(6);
                toast.success(`Location captured (±${Math.round(p.coords.accuracy)} m)`);
              },
              () => toast.error("Could not get your location. Check permissions."),
              { enableHighAccuracy: true, timeout: 15000 },
            );
          }}
        >
          Use my current location (I am at the farm)
        </button>
      </div>
      <TextAreaField name="description" label="Description" defaultValue={farm?.description ?? ""} className="sm:col-span-2" rows={3} />
      {!farm?.id && (
        <div className="sm:col-span-2">
          <label className="text-sm font-medium text-navy-700" htmlFor="photo">
            Farm photo (optional)
          </label>
          <input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="mt-1.5 block w-full text-sm text-navy-600 file:mr-3 file:rounded-lg file:border-0 file:bg-forest-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-forest-800" />
        </div>
      )}
      <div className="sm:col-span-2">
        <SubmitButton>{farm?.id ? "Save changes" : "Create farm"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

// ───────── Field ─────────
export function FieldForm({ farms, field, onDone }: { farms: { id: string; name: string }[]; field?: { id: string; farmId: string; name: string; area: string; areaUnit: string; soilType: string | null; irrigation: string; status: string; notes: string | null }; onDone?: () => void }) {
  const action = field ? updateFieldAction.bind(null, field.id) : createFieldAction;
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2" onSuccess={onDone} successMessage={field ? "Field updated." : undefined}>
      <SelectField name="farmId" label="Farm" required defaultValue={field?.farmId ?? farms[0]?.id} options={farms.map((f) => ({ value: f.id, label: f.name }))} />
      <TextField name="name" label="Field name" required defaultValue={field?.name} placeholder="e.g. Field A (upper)" />
      <TextField name="area" label="Area" type="number" step="0.01" min={0} required defaultValue={field?.area} />
      <SelectField name="areaUnit" label="Unit" defaultValue={field?.areaUnit ?? "HECTARES"} options={[{ value: "HECTARES", label: "Hectares" }, { value: "ACRES", label: "Acres" }]} />
      <TextField name="soilType" label="Soil (if known)" defaultValue={field?.soilType ?? ""} placeholder="e.g. Sandy loam" />
      <SelectField name="irrigation" label="Irrigation" defaultValue={field?.irrigation ?? "RAINFED"} options={[{ value: "RAINFED", label: "Rain-fed" }, { value: "IRRIGATED", label: "Irrigated" }, { value: "PARTIAL", label: "Partially irrigated" }]} />
      <SelectField name="status" label="Status" defaultValue={field?.status ?? "FALLOW"} options={["FALLOW", "PREPARING", "PLANTED", "HARVESTED"].map((v) => ({ value: v, label: v[0] + v.slice(1).toLowerCase() }))} />
      <TextAreaField name="notes" label="Notes" defaultValue={field?.notes ?? ""} className="sm:col-span-2" rows={2} />
      <div className="sm:col-span-2">
        <SubmitButton>{field ? "Save field" : "Add field"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

// ───────── Crop record ─────────
export type CropRecordDefaults = {
  id: string;
  farmId: string;
  fieldId: string | null;
  cropId: string;
  variety: string | null;
  areaPlanted: string | null;
  plantingDate: string | null;
  expectedHarvestDate: string | null;
  growthStage: string;
  estimatedYield: string | null;
  actualHarvest: string | null;
  yieldUnit: string;
  status: string;
  notes: string | null;
};

export function CropRecordForm({ farms, crops, record, onDone, defaultFarmId }: { farms: FarmOpt[]; crops: { id: string; name: string }[]; record?: CropRecordDefaults; onDone?: () => void; defaultFarmId?: string }) {
  const [farmId, setFarmId] = React.useState(record?.farmId ?? defaultFarmId ?? farms[0]?.id ?? "");
  const fields = farms.find((f) => f.id === farmId)?.fields ?? [];
  const action = record ? updateCropRecordAction.bind(null, record.id) : createCropRecordAction;
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2" onSuccess={onDone}>
      <SelectField name="farmId" label="Farm" required value={farmId} onChange={(e) => setFarmId(e.target.value)} options={farms.map((f) => ({ value: f.id, label: f.name }))} />
      <SelectField key={farmId} name="fieldId" label="Field" defaultValue={record?.fieldId ?? ""} placeholder="Whole farm / not set" options={fields.map((f) => ({ value: f.id, label: f.name }))} />
      <SelectField name="cropId" label="Crop" required defaultValue={record?.cropId ?? crops.find((c) => c.name === "Maize")?.id} options={crops.map((c) => ({ value: c.id, label: c.name }))} />
      <TextField name="variety" label="Variety" defaultValue={record?.variety ?? ""} placeholder="e.g. SC 513" />
      <TextField name="plantingDate" label="Planting date" type="date" defaultValue={toDateInput(record?.plantingDate)} />
      <TextField name="expectedHarvestDate" label="Expected harvest" type="date" defaultValue={toDateInput(record?.expectedHarvestDate)} hint="A calendar reminder is created automatically." />
      <TextField name="areaPlanted" label="Area planted (ha)" type="number" step="0.01" min={0} defaultValue={record?.areaPlanted ?? ""} />
      <SelectField name="growthStage" label="Growth stage" defaultValue={record?.growthStage ?? "PLANNED"} options={Object.entries(GROWTH_STAGE_LABEL).map(([value, label]) => ({ value, label }))} />
      <TextField name="estimatedYield" label="Estimated yield" type="number" step="0.01" min={0} defaultValue={record?.estimatedYield ?? ""} />
      <SelectField name="yieldUnit" label="Yield unit" defaultValue={record?.yieldUnit ?? "KG"} options={UNITS.map((u) => ({ value: u, label: UNIT_LABEL[u] }))} />
      <TextField name="actualHarvest" label="Actual harvest" type="number" step="0.01" min={0} defaultValue={record?.actualHarvest ?? ""} hint="Fill in after harvest" />
      <SelectField name="status" label="Status" defaultValue={record?.status ?? "PLANNED"} options={["PLANNED", "GROWING", "HARVESTED", "FAILED"].map((v) => ({ value: v, label: v[0] + v.slice(1).toLowerCase() }))} />
      <TextAreaField name="notes" label="Notes" defaultValue={record?.notes ?? ""} className="sm:col-span-2" rows={2} />
      <div className="sm:col-span-2">
        <SubmitButton>{record ? "Save crop record" : "Add crop"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

// ───────── Activity (online or offline) ─────────
export function ActivityForm({ farms, onDone, defaultFarmId }: { farms: FarmOpt[]; onDone?: () => void; defaultFarmId?: string }) {
  const [farmId, setFarmId] = React.useState(defaultFarmId ?? farms[0]?.id ?? "");
  const farm = farms.find((f) => f.id === farmId);
  const [offlineSaving, setOfflineSaving] = React.useState(false);
  const formRef = React.useRef<HTMLDivElement>(null);

  const action = async (fd: FormData) => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setOfflineSaving(true);
      const payload: Record<string, unknown> = {};
      fd.forEach((v, k) => typeof v === "string" && v !== "" && (payload[k] = v));
      await enqueue("activity.create", payload, `${ACTIVITY_LABEL[payload.type as keyof typeof ACTIVITY_LABEL] ?? "Activity"} · ${farm?.name ?? ""} · ${payload.date}`);
      setOfflineSaving(false);
      return { ok: true as const, message: "Saved on this device. It will sync automatically when you're back online." };
    }
    return recordActivityAction(fd);
  };

  return (
    <div ref={formRef}>
      <ActionForm action={action} className="grid gap-4 sm:grid-cols-2" onSuccess={onDone} resetOnSuccess>
        <SelectField name="farmId" label="Farm" required value={farmId} onChange={(e) => setFarmId(e.target.value)} options={farms.map((f) => ({ value: f.id, label: f.name }))} />
        <SelectField name="type" label="Activity" required defaultValue="PLANTING" options={ACTIVITY_TYPES.map((t) => ({ value: t, label: ACTIVITY_LABEL[t] }))} />
        <SelectField key={`f${farmId}`} name="fieldId" label="Field" placeholder="Not specific" options={(farm?.fields ?? []).map((f) => ({ value: f.id, label: f.name }))} />
        <SelectField key={`c${farmId}`} name="cropRecordId" label="Crop" placeholder="Not specific" options={(farm?.crops ?? []).map((c) => ({ value: c.id, label: c.label }))} />
        <TextField name="date" label="Date" type="date" required defaultValue={toDateInput(new Date())} />
        <div className="grid grid-cols-2 gap-2">
          <TextField name="quantity" label="Quantity" type="number" step="0.01" min={0} />
          <TextField name="unit" label="Unit" placeholder="e.g. bags" />
        </div>
        <TextField name="cost" label="Cost (ZMW)" type="number" step="0.01" min={0} inputMode="decimal" />
        <div className="flex items-end pb-2">
          <Checkbox name="recordExpense" defaultChecked label="Also record the cost as an expense in Finances" />
        </div>
        <TextAreaField name="notes" label="Notes" className="sm:col-span-2" rows={3} placeholder="What was done, product used, number of workers…" />
        <div className="sm:col-span-2">
          <SubmitButton disabled={offlineSaving}>Save activity</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}

// ───────── Task ─────────
export function TaskForm({ farms, onDone, defaults }: { farms: { id: string; name: string }[]; onDone?: () => void; defaults?: { title?: string; dueDate?: string; type?: string } }) {
  const action = async (fd: FormData) => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const payload: Record<string, unknown> = {};
      fd.forEach((v, k) => typeof v === "string" && v !== "" && (payload[k] = v));
      await enqueue("task.create", payload, `Task · ${payload.title}`);
      return { ok: true as const, message: "Task saved on this device. It will sync when you're online." };
    }
    return createTaskAction(fd);
  };
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2" onSuccess={onDone} resetOnSuccess>
      <TextField name="title" label="Task" required defaultValue={defaults?.title} className="sm:col-span-2" />
      <TextField name="dueDate" label="Due date" type="date" required defaultValue={defaults?.dueDate ?? toDateInput(new Date())} />
      <SelectField name="type" label="Type" defaultValue={defaults?.type ?? "OTHER"} options={ACTIVITY_TYPES.map((t) => ({ value: t, label: ACTIVITY_LABEL[t] }))} />
      <SelectField name="farmId" label="Farm" placeholder="Not farm-specific" options={farms.map((f) => ({ value: f.id, label: f.name }))} />
      <div className="flex items-end pb-2">
        <Checkbox name="reminder" defaultChecked label="Remind me" />
      </div>
      <TextAreaField name="description" label="Details" className="sm:col-span-2" rows={2} />
      <div className="sm:col-span-2">
        <SubmitButton>Add task</SubmitButton>
      </div>
    </ActionForm>
  );
}
