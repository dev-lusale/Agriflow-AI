"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, Loader2, X } from "lucide-react";
import { ActionForm, SelectField, SubmitButton, TextAreaField, useFormCtx } from "@/components/forms/action-form";
import { assessCropHealthAction } from "@/server/actions/ai";
import type { FarmOpt } from "@/components/farm/forms";

const MAX = 5 * 1024 * 1024;

export function CropHealthForm({ crops, farms }: { crops: { id: string; name: string }[]; farms: FarmOpt[] }) {
  const router = useRouter();
  const [preview, setPreview] = React.useState<string | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [farmId, setFarmId] = React.useState(farms[0]?.id ?? "");
  const fileRef = React.useRef<HTMLInputElement>(null);
  const farm = farms.find((f) => f.id === farmId);

  return (
    <ActionForm action={assessCropHealthAction} className="space-y-4" onSuccess={(d) => d && router.push(`/farmer/crop-health?a=${(d as { id: string }).id}`)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField name="cropId" label="Crop" required defaultValue={crops.find((c) => c.name === "Maize")?.id} options={crops.map((c) => ({ value: c.id, label: c.name }))} />
        {farms.length > 0 && <SelectField name="farmId" label="Farm" value={farmId} onChange={(e) => setFarmId(e.target.value)} options={farms.map((f) => ({ value: f.id, label: f.name }))} />}
        {farm && farm.crops.length > 0 && <SelectField key={farmId} name="cropRecordId" label="Crop record (optional)" placeholder="Not linked" options={farm.crops.map((c) => ({ value: c.id, label: c.label }))} className="sm:col-span-2" />}
      </div>

      <div>
        <p className="text-sm font-medium text-navy-700">Photograph (recommended)</p>
        <p className="text-xs text-navy-500">JPEG or PNG, up to 5 MB. Take a close, well-lit photo of the affected leaves.</p>
        <input
          ref={fileRef}
          type="file"
          name="image"
          accept="image/jpeg,image/png"
          capture="environment"
          className="sr-only"
          id="crop-image"
          onChange={(e) => {
            const f = e.target.files?.[0];
            setFileError(null);
            if (!f) return setPreview(null);
            if (f.size > MAX) {
              setFileError("This photo is larger than 5 MB. Please choose a smaller one.");
              e.target.value = "";
              return setPreview(null);
            }
            if (!["image/jpeg", "image/png"].includes(f.type)) {
              setFileError("Please use a JPEG or PNG photo.");
              e.target.value = "";
              return setPreview(null);
            }
            setPreview(URL.createObjectURL(f));
          }}
        />
        {preview ? (
          <div className="relative mt-2 w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Selected crop" className="max-h-56 rounded-xl border border-border object-cover" />
            <button
              type="button"
              className="absolute right-2 top-2 rounded-full bg-white/90 p-1 shadow"
              onClick={() => {
                setPreview(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
              aria-label="Remove photo"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <label htmlFor="crop-image" className="mt-2 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-navy-200 bg-navy-50/60 px-4 py-8 text-sm text-navy-600 hover:border-forest-400 hover:bg-forest-50">
            <span className="flex gap-2 text-forest-700">
              <Camera className="size-6" /> <ImagePlus className="size-6" />
            </span>
            Take a photo or choose from gallery
          </label>
        )}
        {fileError && <p className="mt-1 text-xs font-medium text-red-600">{fileError}</p>}
      </div>

      <TextAreaField name="symptoms" label="What do you see?" required rows={4} placeholder="e.g. Lower leaves turning yellow from the tip, small holes in the leaf whorl, started 1 week ago on about 20% of plants…" />
      <Submit />
    </ActionForm>
  );
}

function Submit() {
  const { pending } = useFormCtx();
  return (
    <div className="flex items-center gap-3">
      <SubmitButton>Analyse with Grok</SubmitButton>
      {pending && (
        <span className="flex items-center gap-2 text-sm text-navy-500">
          <Loader2 className="size-4 animate-spin" /> Uploading and analysing. This can take up to a minute.
        </span>
      )}
    </div>
  );
}
