"use client";

import { useRouter } from "next/navigation";
import { ActionForm, SelectField, SubmitButton, useFormCtx } from "@/components/forms/action-form";
import type { ActionResult } from "@/lib/errors";
import { Loader2 } from "lucide-react";

export function GenerateReportForm({ action, options, basePath }: { action: (fd: FormData) => Promise<ActionResult<{ id: string }>>; options: { value: string; label: string }[]; basePath: string }) {
  const router = useRouter();
  return (
    <ActionForm action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end" onSuccess={(d) => d && router.push(`${basePath}/${d.id}`)}>
      <SelectField name="type" label="Report type" options={options} className="sm:w-72" />
      <SubmitButton>Generate report</SubmitButton>
      <Pending />
    </ActionForm>
  );
}

function Pending() {
  const { pending } = useFormCtx();
  return pending ? (
    <span className="flex items-center gap-2 pb-2 text-sm text-navy-500">
      <Loader2 className="size-4 animate-spin" /> Computing figures and asking Grok to write the summary…
    </span>
  ) : null;
}
