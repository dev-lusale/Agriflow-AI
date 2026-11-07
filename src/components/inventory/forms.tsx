"use client";

import * as React from "react";
import { ActionForm, SelectField, SubmitButton, TextField } from "@/components/forms/action-form";
import { Checkbox } from "@/components/ui/primitives";
import { INVENTORY_CATEGORY_LABEL } from "@/lib/labels";
import { createInventoryItemAction, moveStockAction } from "@/server/actions/ops";

export function InventoryItemForm({ farms }: { farms: { id: string; name: string }[] }) {
  return (
    <ActionForm action={createInventoryItemAction} className="grid gap-4 sm:grid-cols-2">
      <TextField name="name" label="Item name" required className="sm:col-span-2" placeholder="e.g. Compound D (50 kg)" />
      <SelectField name="category" label="Category" required options={Object.entries(INVENTORY_CATEGORY_LABEL).map(([value, label]) => ({ value, label }))} />
      <TextField name="unit" label="Unit" required placeholder="bag, litre, kg, unit" />
      <TextField name="quantity" label="Opening quantity" type="number" step="0.01" min={0} required defaultValue="0" />
      <TextField name="unitCost" label="Purchase price per unit (ZMW)" type="number" step="0.01" min={0} />
      <TextField name="minStockLevel" label="Minimum stock level" type="number" step="0.01" min={0} defaultValue="0" hint="You'll get a low-stock alert at this level." />
      <TextField name="storageLocation" label="Storage location" />
      <TextField name="expiryDate" label="Expiry date" type="date" />
      {farms.length > 0 && <SelectField name="farmId" label="Farm" placeholder="Not farm-specific" options={farms.map((f) => ({ value: f.id, label: f.name }))} />}
      <div className="sm:col-span-2">
        <SubmitButton>Add item</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function StockMoveForm({ itemId, unit }: { itemId: string; unit: string }) {
  const [dir, setDir] = React.useState("IN");
  return (
    <ActionForm action={moveStockAction} className="space-y-3">
      <input type="hidden" name="itemId" value={itemId} />
      <SelectField
        name="direction"
        label="Movement"
        value={dir}
        onChange={(e) => setDir(e.target.value)}
        options={[
          { value: "IN", label: "Stock in (purchase / harvest)" },
          { value: "OUT", label: "Stock out (use / sale)" },
          { value: "ADJUST", label: "Set counted stock level" },
        ]}
      />
      <TextField name="quantity" label={dir === "ADJUST" ? `Counted quantity (${unit})` : `Quantity (${unit})`} type="number" step="0.01" min={0} required />
      {dir === "IN" && <TextField name="unitCost" label="Unit cost (ZMW, optional)" type="number" step="0.01" min={0} />}
      <TextField name="reason" label="Reason" placeholder={dir === "OUT" ? "e.g. Applied to Field A" : "e.g. Bought from agro-dealer"} />
      {dir === "OUT" && <Checkbox name="allowNegative" label="Authorise going below zero (stock-count correction)" />}
      <SubmitButton className="w-full">Save movement</SubmitButton>
    </ActionForm>
  );
}
