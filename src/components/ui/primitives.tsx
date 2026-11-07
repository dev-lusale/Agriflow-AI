import * as React from "react";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/labels";

// ───────── Card (frosted glass, large radius) ─────────
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("glass rounded-[1.75rem] shadow-[var(--shadow-card)] transition-shadow duration-300", className)} {...props} />;
}
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 p-5 pb-3 sm:p-6 sm:pb-3", className)} {...props} />;
}
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-[1.05rem] font-semibold text-navy-900", className)} {...props} />;
}
export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-navy-500", className)} {...props} />;
}
export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-0 sm:p-6 sm:pt-0", className)} {...props} />;
}
export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center gap-2 border-t border-border px-5 py-3 sm:px-6", className)} {...props} />;
}

// ───────── Badge (soft, no hard ring) ─────────
const toneClass: Record<Tone, string> = {
  green: "bg-forest-50 text-forest-700",
  amber: "bg-harvest-50 text-harvest-700",
  red: "bg-red-50 text-red-600",
  blue: "bg-sky-50 text-sky-700",
  slate: "bg-navy-100 text-navy-600",
  navy: "bg-ink text-white",
};
export function Badge({ tone = "slate", className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", toneClass[tone], className)} {...props} />;
}

/** Small trend chip like "▲ 6.9% from last week". */
export function Trend({ value, suffix, className }: { value: number; suffix?: string; className?: string }) {
  const up = value >= 0;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", up ? "text-forest-600" : "text-red-500", className)}>
      <span aria-hidden>{up ? "▲" : "▼"}</span>
      {Math.abs(value).toFixed(1)}%
      {suffix && <span className="font-normal text-navy-500">{suffix}</span>}
    </span>
  );
}

// ───────── Form controls ─────────
const control =
  "w-full rounded-2xl border border-navy-200/80 bg-white/90 px-4 text-[0.95rem] text-navy-900 shadow-[inset_0_1px_0_rgb(255_255_255/0.6)] transition-[border-color,box-shadow] duration-200 placeholder:text-navy-400 hover:border-navy-300 focus:border-ink focus:outline-none focus:ring-4 focus:ring-ink/5 disabled:cursor-not-allowed disabled:bg-navy-50 disabled:text-navy-400 aria-[invalid=true]:border-red-400 aria-[invalid=true]:ring-red-100";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(control, "h-11", className)} {...props} />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(control, "min-h-[96px] py-3", className)} {...props} />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      control,
      "h-11 cursor-pointer appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 fill=%22none%22 stroke=%22%230d1116%22 stroke-width=%222%22 viewBox=%220 0 24 24%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:16px] bg-[right_0.9rem_center] bg-no-repeat pr-10",
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-medium text-navy-600", className)} {...props} />;
}

/** Label + control + hint/error wrapper. */
export function Field({ label, htmlFor, hint, error, required, className, children }: { label: string; htmlFor?: string; hint?: React.ReactNode; error?: string | string[]; required?: boolean; className?: string; children: React.ReactNode }) {
  const msg = Array.isArray(error) ? error[0] : error;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="text-red-500"> *</span>}
      </Label>
      {children}
      {msg ? <p className="animate-fade-in text-xs font-medium text-red-600">{msg}</p> : hint ? <p className="text-xs text-navy-500">{hint}</p> : null}
    </div>
  );
}

export function Checkbox({ label, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-2.5 text-sm text-navy-700", className)}>
      <input type="checkbox" className="mt-0.5 size-[18px] shrink-0 cursor-pointer rounded-md border-navy-300 accent-ink" {...props} />
      <span>{label}</span>
    </label>
  );
}

// ───────── Table (airy list style) ─────────
export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto [-webkit-overflow-scrolling:touch]">
      <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}
export const THead = (p: React.HTMLAttributes<HTMLTableSectionElement>) => <thead {...p} className={cn("border-b border-border", p.className)} />;
export const TBody = (p: React.HTMLAttributes<HTMLTableSectionElement>) => <tbody {...p} className={cn("divide-y divide-border", p.className)} />;
export const TR = (p: React.HTMLAttributes<HTMLTableRowElement>) => <tr {...p} className={cn("transition-colors duration-150 hover:bg-white/70", p.className)} />;
export const TH = (p: React.ThHTMLAttributes<HTMLTableCellElement>) => <th {...p} className={cn("h-11 whitespace-nowrap px-5 text-left align-middle text-xs font-medium text-navy-500", p.className)} />;
export const TD = (p: React.TdHTMLAttributes<HTMLTableCellElement>) => <td {...p} className={cn("px-5 py-3.5 align-middle text-navy-700", p.className)} />;

// ───────── Misc ─────────
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-2xl", className)} />;
}

export function Separator({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-border", className)} />;
}

export function Alert({ tone = "slate", title, children, icon, className }: { tone?: Tone; title?: React.ReactNode; children?: React.ReactNode; icon?: React.ReactNode; className?: string }) {
  const tones: Record<Tone, string> = {
    green: "bg-forest-50/90 text-forest-800",
    amber: "bg-harvest-50/90 text-harvest-800",
    red: "bg-red-50/90 text-red-800",
    blue: "bg-sky-50/90 text-sky-800",
    slate: "bg-white/70 text-navy-700",
    navy: "bg-ink text-white",
  };
  return (
    <div role="status" className={cn("flex animate-fade-in gap-3 rounded-2xl border border-white/70 px-4 py-3 text-sm backdrop-blur", tones[tone], className)}>
      {icon && <div className="mt-0.5 shrink-0 [&_svg]:size-4">{icon}</div>}
      <div className="space-y-0.5">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-relaxed opacity-90">{children}</div>}
      </div>
    </div>
  );
}

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-navy-200/70", className)}>
      <div className="h-full rounded-full bg-ink transition-[width] duration-700 ease-out" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/** Circular icon tile, used for list rows and quick actions (like the reference's merchant icons). */
export function IconTile({ children, className, tone = "white" }: { children: React.ReactNode; className?: string; tone?: "white" | "ink" | "green" | "amber" | "sky" | "red" }) {
  const tones = { white: "bg-white text-navy-800 shadow-sm", ink: "bg-ink text-white", green: "bg-forest-50 text-forest-700", amber: "bg-harvest-50 text-harvest-700", sky: "bg-sky-50 text-sky-700", red: "bg-red-50 text-red-600" };
  return <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full [&_svg]:size-[18px]", tones[tone], className)}>{children}</span>;
}
