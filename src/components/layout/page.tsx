import * as React from "react";
import Link from "next/link";
import { ChevronLeft, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge, Card } from "@/components/ui/primitives";
import { LogoMark } from "@/components/brand/logo";
import { statusTone } from "@/lib/labels";
import { titleCase } from "@/lib/utils";

/** Page heading: small muted eyebrow + large, light title (reference: "Your Financial Overview / Welcome to …"). */
export function PageHeader({ title, description, actions, back, eyebrow }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; back?: { href: string; label: string }; eyebrow?: string }) {
  return (
    <div className="mb-6 flex animate-fade-up flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="group mb-3 inline-flex items-center gap-1 rounded-full bg-white/70 py-1 pl-1.5 pr-3 text-sm font-medium text-navy-600 shadow-sm backdrop-blur transition hover:bg-white hover:text-navy-900">
            <ChevronLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
            {back.label}
          </Link>
        )}
        {eyebrow && <p className="text-sm font-medium text-navy-500">{eyebrow}</p>}
        <h1 className="text-[1.75rem] font-semibold leading-tight sm:text-[2.1rem]">{title}</h1>
        {description && <div className="mt-1.5 max-w-2xl text-[0.95rem] text-navy-500">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, icon: Icon, tone = "forest", href }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: LucideIcon; tone?: "forest" | "navy" | "amber" | "sky"; href?: string }) {
  const tones = { forest: "bg-forest-50 text-forest-700", navy: "bg-navy-100 text-navy-700", amber: "bg-harvest-50 text-harvest-700", sky: "bg-sky-50 text-sky-700" };
  const inner = (
    <Card className={cn("flex h-full flex-col justify-between gap-4 p-4 sm:p-5", href && "hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]", "transition-[transform,box-shadow] duration-300")}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-navy-500">{label}</p>
        {Icon && (
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", tones[tone])}>
            <Icon className="size-[18px]" />
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className="num truncate text-[1.6rem] font-normal leading-none text-navy-900 sm:text-[1.9rem]">{value}</p>
        {hint && <p className="mt-1.5 text-xs text-navy-500">{hint}</p>}
      </div>
    </Card>
  );
  return href ? (
    <Link href={href} className="block h-full rounded-[1.75rem] focus-visible:outline-offset-4">
      {inner}
    </Link>
  ) : (
    inner
  );
}

/**
 * Iridescent hero card (reference: the frosted "balance" card).
 * Shows a headline figure with its label and up to two meta columns.
 */
export function HeroCard({ eyebrow, label, value, meta, footer, className, badge }: { eyebrow?: React.ReactNode; label: string; value: React.ReactNode; meta?: [string, React.ReactNode][]; footer?: React.ReactNode; className?: string; badge?: React.ReactNode }) {
  return (
    <div className={cn("iridescent relative animate-fade-up overflow-hidden rounded-[2rem] border border-white/80 p-5 shadow-[var(--shadow-float)] sm:p-7", className)}>
      <div className="pointer-events-none absolute -right-10 -top-16 size-56 rounded-full bg-white/40 blur-3xl" aria-hidden />
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-navy-800">
          <LogoMark className="size-7 rounded-lg" />
          {eyebrow}
        </div>
        {badge}
      </div>
      <div className="relative mt-8 sm:mt-10">
        <p className="text-sm text-navy-600">{label}</p>
        <p className="num mt-1 text-[2.4rem] font-light leading-none text-navy-900 sm:text-[3rem]">{value}</p>
      </div>
      {meta && meta.length > 0 && (
        <div className="relative mt-6 flex flex-wrap gap-x-10 gap-y-3 sm:mt-8">
          {meta.map(([k, v]) => (
            <div key={k}>
              <p className="text-xs text-navy-500">{k}</p>
              <p className="num mt-0.5 text-sm font-semibold text-navy-800">{v}</p>
            </div>
          ))}
        </div>
      )}
      {footer && <div className="relative mt-6">{footer}</div>}
    </div>
  );
}

/** Round quick-action button with caption (reference: Show PIN / Card Details / Freeze Card). */
export function QuickAction({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <Link href={href} className="group flex flex-col items-center gap-2 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-white/90 text-navy-800 shadow-[var(--shadow-card)] ring-1 ring-black/[0.03] transition duration-300 group-hover:-translate-y-0.5 group-hover:bg-white group-hover:shadow-[var(--shadow-lift)] group-active:scale-95">
        <Icon className="size-5" />
      </span>
      <span className="text-xs font-medium text-navy-700">{label}</span>
    </Link>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className }: { icon?: LucideIcon; title: string; description?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("glass flex animate-fade-in flex-col items-center justify-center rounded-[1.75rem] px-6 py-14 text-center", className)}>
      {Icon && (
        <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-white text-navy-700 shadow-[var(--shadow-card)]">
          <Icon className="size-6" />
        </div>
      )}
      <p className="text-lg font-semibold text-navy-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-navy-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <Badge tone={statusTone(status)}>{label ?? titleCase(status)}</Badge>;
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-lg font-semibold">{children}</h2>
      {action}
    </div>
  );
}

export function KeyValue({ items, className }: { items: [string, React.ReactNode][]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2", className)}>
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs font-medium text-navy-500">{k}</dt>
          <dd className="mt-0.5 break-words text-sm font-medium text-navy-800">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DataLabel({ kind }: { kind: "ACTUAL" | "ESTIMATE" | "DEMO" | "VERIFIED" | "USER_OFFER" | "HISTORICAL" | "MODELLED" | "FORECAST" }) {
  const map = {
    ACTUAL: { t: "Recorded actual", tone: "green" as const },
    ESTIMATE: { t: "Estimate", tone: "amber" as const },
    DEMO: { t: "Demo data", tone: "amber" as const },
    VERIFIED: { t: "Verified observation", tone: "green" as const },
    USER_OFFER: { t: "User-submitted offer", tone: "blue" as const },
    HISTORICAL: { t: "Historical record", tone: "slate" as const },
    MODELLED: { t: "Model analysis", tone: "blue" as const },
    FORECAST: { t: "Forecast", tone: "slate" as const },
  }[kind];
  return <Badge tone={map.tone}>{map.t}</Badge>;
}
