import * as React from "react";
import Link from "next/link";
import { ChevronLeft, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge, Card } from "@/components/ui/primitives";
import { statusTone } from "@/lib/labels";
import { titleCase } from "@/lib/utils";

export function PageHeader({ title, description, actions, back, eyebrow }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; back?: { href: string; label: string }; eyebrow?: string }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-navy-500 hover:text-forest-700">
            <ChevronLeft className="size-4" />
            {back.label}
          </Link>
        )}
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-wider text-forest-600">{eyebrow}</p>}
        <h1 className="text-2xl font-bold sm:text-[1.65rem]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-navy-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, icon: Icon, tone = "forest", href }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: LucideIcon; tone?: "forest" | "navy" | "amber" | "sky"; href?: string }) {
  const tones = { forest: "bg-forest-50 text-forest-700", navy: "bg-navy-100 text-navy-700", amber: "bg-harvest-50 text-harvest-700", sky: "bg-sky-50 text-sky-700" };
  const inner = (
    <Card className={cn("flex items-start gap-4 p-4 sm:p-5", href && "transition-shadow hover:shadow-[var(--shadow-lift)]")}>
      {Icon && (
        <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", tones[tone])}>
          <Icon className="size-5" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-navy-500">{label}</p>
        <p className="mt-1 truncate text-xl font-bold text-navy-900 sm:text-2xl">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-navy-500">{hint}</p>}
      </div>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export function EmptyState({ icon: Icon, title, description, action, className }: { icon?: LucideIcon; title: string; description?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl border border-dashed border-navy-200 bg-white px-6 py-12 text-center", className)}>
      {Icon && (
        <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-forest-50 text-forest-600">
          <Icon className="size-6" />
        </div>
      )}
      <p className="font-semibold text-navy-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-navy-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <Badge tone={statusTone(status)}>{label ?? titleCase(status)}</Badge>;
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-base font-semibold">{children}</h2>
      {action}
    </div>
  );
}

export function KeyValue({ items, className }: { items: [string, React.ReactNode][]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2", className)}>
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-navy-400">{k}</dt>
          <dd className="mt-0.5 break-words text-sm text-navy-800">{v ?? "—"}</dd>
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
