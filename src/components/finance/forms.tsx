"use client";

import * as React from "react";
import { ActionForm, SelectField, SubmitButton, TextField } from "@/components/forms/action-form";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, TXN_CATEGORY_LABEL } from "@/lib/labels";
import { toDateInput } from "@/lib/utils";
import { recordEstimateAction, recordTransactionAction } from "@/server/actions/ops";
import type { FarmOpt } from "@/components/farm/forms";

export function TransactionForm({ farms, defaultType = "EXPENSE" }: { farms: FarmOpt[]; defaultType?: "INCOME" | "EXPENSE" }) {
  const [type, setType] = React.useState(defaultType);
  const [farmId, setFarmId] = React.useState("");
  const farm = farms.find((f) => f.id === farmId);
  const cats = type === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  return (
    <ActionForm action={recordTransactionAction} className="grid gap-4 sm:grid-cols-2" resetOnSuccess>
      <SelectField name="type" label="Type" value={type} onChange={(e) => setType(e.target.value as "INCOME" | "EXPENSE")} options={[{ value: "EXPENSE", label: "Expense" }, { value: "INCOME", label: "Income" }]} />
      <SelectField key={type} name="category" label="Category" required options={cats.map((c) => ({ value: c, label: TXN_CATEGORY_LABEL[c] }))} />
      <TextField name="amount" label="Amount (ZMW)" type="number" step="0.01" min={0} required inputMode="decimal" />
      <TextField name="date" label="Date" type="date" required defaultValue={toDateInput(new Date())} />
      <SelectField name="farmId" label="Farm" value={farmId} onChange={(e) => setFarmId(e.target.value)} placeholder="Whole business" options={farms.map((f) => ({ value: f.id, label: f.name }))} />
      <SelectField key={`c${farmId}`} name="cropRecordId" label="Crop" placeholder="Not crop-specific" options={(farm?.crops ?? []).map((c) => ({ value: c.id, label: c.label }))} disabled={!farm} />
      <SelectField key={`f${farmId}`} name="fieldId" label="Field" placeholder="Not field-specific" options={(farm?.fields ?? []).map((f) => ({ value: f.id, label: f.name }))} disabled={!farm} />
      <TextField name="description" label="Description" placeholder="e.g. 12 bags Compound D from agro-dealer" />
      <p className="text-xs text-navy-500 sm:col-span-2">Recorded as an actual amount. Use Budget estimates for planned figures.</p>
      <div className="sm:col-span-2">
        <SubmitButton>Save transaction</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function EstimateForm({ farms }: { farms: FarmOpt[] }) {
  const [type, setType] = React.useState("ESTIMATED_COST");
  const [farmId, setFarmId] = React.useState("");
  const farm = farms.find((f) => f.id === farmId);
  return (
    <ActionForm action={recordEstimateAction} className="grid gap-4 sm:grid-cols-2" resetOnSuccess>
      <SelectField name="type" label="Estimate" value={type} onChange={(e) => setType(e.target.value)} options={[{ value: "ESTIMATED_COST", label: "Planned cost" }, { value: "ESTIMATED_REVENUE", label: "Expected revenue" }]} />
      <SelectField key={type} name="category" label="Category" options={(type === "ESTIMATED_REVENUE" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => ({ value: c, label: TXN_CATEGORY_LABEL[c] }))} />
      <TextField name="amount" label="Amount (ZMW)" type="number" step="0.01" min={0} required />
      <TextField name="season" label="Season" required defaultValue={`${new Date().getFullYear()}/${String(new Date().getFullYear() + 1).slice(2)}`} />
      <SelectField name="farmId" label="Farm" value={farmId} onChange={(e) => setFarmId(e.target.value)} placeholder="Whole business" options={farms.map((f) => ({ value: f.id, label: f.name }))} />
      <SelectField key={farmId} name="cropRecordId" label="Crop" placeholder="Not crop-specific" options={(farm?.crops ?? []).map((c) => ({ value: c.id, label: c.label }))} disabled={!farm} />
      <TextField name="description" label="Assumptions" className="sm:col-span-2" placeholder="e.g. 240 bags × K350" />
      <div className="sm:col-span-2">
        <SubmitButton>Save estimate</SubmitButton>
      </div>
    </ActionForm>
  );
}
