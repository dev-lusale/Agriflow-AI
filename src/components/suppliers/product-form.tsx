"use client";

import * as React from "react";
import { ActionForm, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/forms/action-form";
import { Checkbox } from "@/components/ui/primitives";
import { UNIT_LABEL, UNITS } from "@/lib/labels";
import { createProductAction, updateProductAction } from "@/server/actions/ops";

type Cat = { id: string; name: string; requiresSafetyInfo: boolean };
export type ProductDefaults = { id: string; categoryId: string; name: string; brand: string | null; description: string | null; unit: string; price: string; stock: string; minStockLevel: string; registrationNumber: string | null; safetyInfo: string | null; isActive: boolean };

export function ProductForm({ categories, product }: { categories: Cat[]; product?: ProductDefaults }) {
  const [catId, setCatId] = React.useState(product?.categoryId ?? categories[0]?.id ?? "");
  const cat = categories.find((c) => c.id === catId);
  const action = product ? updateProductAction.bind(null, product.id) : createProductAction;
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2">
      <SelectField name="categoryId" label="Category" required value={catId} onChange={(e) => setCatId(e.target.value)} options={categories.map((c) => ({ value: c.id, label: c.name }))} />
      <TextField name="name" label="Product name" required defaultValue={product?.name} />
      <TextField name="brand" label="Brand / manufacturer" defaultValue={product?.brand ?? ""} />
      <SelectField name="unit" label="Selling unit" required defaultValue={product?.unit ?? "BAG_50KG"} options={UNITS.map((u) => ({ value: u, label: UNIT_LABEL[u] }))} />
      <TextField name="price" label="Price per unit (ZMW)" type="number" step="0.01" min={0} required defaultValue={product?.price} />
      {product ? <input type="hidden" name="stock" value={product.stock} /> : <TextField name="stock" label="Opening stock" type="number" step="1" min={0} required defaultValue="0" />}
      <TextField name="minStockLevel" label="Low-stock alert at" type="number" step="1" min={0} defaultValue={product?.minStockLevel ?? "0"} />
      <TextAreaField name="description" label="Description" defaultValue={product?.description ?? ""} className="sm:col-span-2" rows={3} />
      {cat?.requiresSafetyInfo && (
        <div className="grid gap-4 rounded-xl bg-harvest-50 p-4 sm:col-span-2 sm:grid-cols-2">
          <p className="text-sm font-semibold text-harvest-800 sm:col-span-2">Crop protection products need safety and registration information</p>
          <TextField name="registrationNumber" label="Regulatory registration no." defaultValue={product?.registrationNumber ?? ""} hint="As declared by you. Shown as 'not verified' until an admin checks it." />
          <TextAreaField name="safetyInfo" label="Safety & handling (from label)" required defaultValue={product?.safetyInfo ?? ""} rows={3} className="sm:col-span-2" />
        </div>
      )}
      {!product && (
        <div className="sm:col-span-2">
          <label className="text-sm font-medium text-navy-700" htmlFor="pimage">
            Photo (optional)
          </label>
          <input id="pimage" name="image" type="file" accept="image/jpeg,image/png,image/webp" className="mt-1.5 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-forest-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-forest-800" />
        </div>
      )}
      <Checkbox name="isActive" defaultChecked={product?.isActive ?? true} label="Visible to farmers" className="sm:col-span-2" />
      <div className="sm:col-span-2">
        <SubmitButton>{product ? "Save product" : "Publish product"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
