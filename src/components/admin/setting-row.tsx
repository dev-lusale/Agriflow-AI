"use client";

import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Input } from "@/components/ui/primitives";
import { saveSettingAction } from "@/server/actions/admin";

export function SettingRow({ k, label, value }: { k: string; label: string; value: string | number | boolean }) {
  return (
    <ActionForm action={saveSettingAction} className="flex flex-col gap-2 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
      <input type="hidden" name="key" value={k} />
      <label className="text-sm font-medium text-navy-800" htmlFor={k}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        {typeof value === "boolean" ? (
          <input id={k} type="checkbox" name="value" defaultChecked={value} className="size-5 accent-forest-700" />
        ) : (
          <Input id={k} name="value" type={typeof value === "number" ? "number" : "text"} defaultValue={String(value)} className="h-9 w-48" />
        )}
        <SubmitButton size="sm" variant="secondary">
          Save
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
