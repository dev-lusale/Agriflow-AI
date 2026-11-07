"use client";

import { ActionForm, SelectField, SubmitButton, TextField } from "@/components/forms/action-form";
import { Checkbox } from "@/components/ui/primitives";
import { UNIT_LABEL, UNITS } from "@/lib/labels";
import { upsertCategoryAction, upsertCropAction } from "@/server/actions/admin";

export function CropForm({ crop }: { crop?: { id: string; name: string; category: string; defaultUnit: string; isActive: boolean } }) {
  return (
    <ActionForm action={upsertCropAction} className="space-y-3">
      {crop && <input type="hidden" name="id" value={crop.id} />}
      <TextField name="name" label="Crop name" required defaultValue={crop?.name} />
      <TextField name="category" label="Category" required defaultValue={crop?.category ?? ""} placeholder="Cereal, Legume, Vegetable…" />
      <SelectField name="defaultUnit" label="Default unit" defaultValue={crop?.defaultUnit ?? "KG"} options={UNITS.map((u) => ({ value: u, label: UNIT_LABEL[u] }))} />
      <Checkbox name="isActive" defaultChecked={crop?.isActive ?? true} label="Active (available to farmers)" />
      <SubmitButton>Save crop</SubmitButton>
    </ActionForm>
  );
}

export function CategoryForm({ category }: { category?: { id: string; name: string; requiresSafetyInfo: boolean; isActive: boolean } }) {
  return (
    <ActionForm action={upsertCategoryAction} className="space-y-3">
      {category && <input type="hidden" name="id" value={category.id} />}
      <TextField name="name" label="Category name" required defaultValue={category?.name} />
      <Checkbox name="requiresSafetyInfo" defaultChecked={category?.requiresSafetyInfo} label="Requires safety & registration information" />
      <Checkbox name="isActive" defaultChecked={category?.isActive ?? true} label="Active" />
      <SubmitButton>Save category</SubmitButton>
    </ActionForm>
  );
}
