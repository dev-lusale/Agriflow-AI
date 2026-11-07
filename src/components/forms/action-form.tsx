"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { ActionResult } from "@/lib/errors";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/primitives";

type FormCtx = { errors?: Record<string, string[] | undefined>; pending: boolean };
const Ctx = React.createContext<FormCtx>({ pending: false });

export type ServerAction<T = unknown> = (formData: FormData) => Promise<ActionResult<T>>;

/**
 * Submits FormData to a server action without React's automatic form reset,
 * shows field errors inline and a toast for the result.
 */
export function ActionForm<T>({
  action,
  children,
  className,
  successMessage,
  resetOnSuccess,
  onSuccess,
  refresh = true,
  confirm,
}: {
  action: ServerAction<T>;
  children: React.ReactNode;
  className?: string;
  successMessage?: string;
  resetOnSuccess?: boolean;
  onSuccess?: (data: T | undefined) => void;
  refresh?: boolean;
  confirm?: string;
}) {
  const [pending, start] = React.useTransition();
  const [errors, setErrors] = React.useState<FormCtx["errors"]>();
  const router = useRouter();
  const ref = React.useRef<HTMLFormElement>(null);

  return (
    <Ctx.Provider value={{ errors, pending }}>
      <form
        ref={ref}
        className={className}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (confirm && !window.confirm(confirm)) return;
          const fd = new FormData(e.currentTarget);
          start(async () => {
            const res = await action(fd);
            if (!res) return;
            if (res.ok) {
              setErrors(undefined);
              const msg = res.message ?? successMessage;
              if (msg) toast.success(msg);
              if (resetOnSuccess) ref.current?.reset();
              onSuccess?.(res.data);
              if (refresh) router.refresh();
            } else {
              setErrors(res.fieldErrors);
              toast.error(res.error);
            }
          });
        }}
      >
        {children}
      </form>
    </Ctx.Provider>
  );
}

export function useFormCtx() {
  return React.useContext(Ctx);
}

export function SubmitButton({ children, ...props }: ButtonProps) {
  const { pending } = useFormCtx();
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending && <Loader2 className="animate-spin" />}
      {children}
    </Button>
  );
}

type Common = { name: string; label: string; hint?: React.ReactNode; required?: boolean; className?: string };

export function TextField({ name, label, hint, required, className, ...rest }: Common & React.InputHTMLAttributes<HTMLInputElement>) {
  const { errors } = useFormCtx();
  const err = errors?.[name];
  return (
    <Field label={label} htmlFor={name} hint={hint} error={err} required={required} className={className}>
      <Input id={name} name={name} aria-invalid={Boolean(err)} required={required} {...rest} />
    </Field>
  );
}

export function TextAreaField({ name, label, hint, required, className, ...rest }: Common & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { errors } = useFormCtx();
  const err = errors?.[name];
  return (
    <Field label={label} htmlFor={name} hint={hint} error={err} required={required} className={className}>
      <Textarea id={name} name={name} aria-invalid={Boolean(err)} {...rest} />
    </Field>
  );
}

export function SelectField({
  name,
  label,
  hint,
  required,
  className,
  options,
  placeholder,
  ...rest
}: Common & React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[]; placeholder?: string }) {
  const { errors } = useFormCtx();
  const err = errors?.[name];
  return (
    <Field label={label} htmlFor={name} hint={hint} error={err} required={required} className={className}>
      <Select id={name} name={name} aria-invalid={Boolean(err)} {...rest}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}

export function FormError({ name }: { name: string }) {
  const { errors } = useFormCtx();
  const err = errors?.[name]?.[0];
  return err ? <p className="text-xs font-medium text-red-600">{err}</p> : null;
}

/** Small inline button that runs a server action (e.g. status change) with optional confirm + prompt for a note. */
export function ActionButton({
  action,
  children,
  confirm,
  promptNote,
  successMessage,
  onDone,
  ...props
}: Omit<ButtonProps, "onClick" | "action"> & { action: (note?: string) => Promise<ActionResult<unknown>>; confirm?: string; promptNote?: string; successMessage?: string; onDone?: () => void }) {
  const [pending, start] = React.useTransition();
  const router = useRouter();
  return (
    <Button
      {...props}
      disabled={pending || props.disabled}
      onClick={() => {
        let note: string | undefined;
        if (promptNote) {
          const v = window.prompt(promptNote);
          if (v === null) return;
          note = v.trim() || undefined;
        } else if (confirm && !window.confirm(confirm)) return;
        start(async () => {
          const res = await action(note);
          if (res.ok) {
            toast.success(res.message ?? successMessage ?? "Done");
            onDone?.();
            router.refresh();
          } else toast.error(res.error);
        });
      }}
    >
      {pending && <Loader2 className="animate-spin" />}
      {children}
    </Button>
  );
}
