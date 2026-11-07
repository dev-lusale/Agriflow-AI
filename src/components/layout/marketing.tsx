import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MarketingHero({ eyebrow, title, intro, cta }: { eyebrow: string; title: string; intro: string; cta?: { href: string; label: string } }) {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20 lg:px-8">
        <p className="inline-flex rounded-full bg-white/80 px-3 py-1 text-sm font-medium text-navy-600 shadow-sm">{eyebrow}</p>
        <h1 className="mt-2 max-w-3xl text-4xl font-semibold leading-[1.05] sm:text-6xl">{title}</h1>
        <p className="mt-4 max-w-2xl text-lg text-navy-600">{intro}</p>
        {cta && (
          <Button asChild size="lg" className="mt-8">
            <Link href={cta.href}>
              {cta.label} <ArrowRight />
            </Link>
          </Button>
        )}
      </div>
    </section>
  );
}

export function FeatureGrid({ items, cols = 3 }: { items: { icon: LucideIcon; title: string; body: string }[]; cols?: 2 | 3 }) {
  return (
    <div className={`grid gap-5 sm:grid-cols-2 ${cols === 3 ? "lg:grid-cols-3" : ""}`}>
      {items.map((f) => (
        <div key={f.title} className="glass rounded-[1.75rem] p-6 shadow-[var(--shadow-card)]">
          <div className="flex size-10 items-center justify-center rounded-xl bg-forest-50 text-forest-700">
            <f.icon className="size-5" />
          </div>
          <h3 className="mt-4 font-semibold">{f.title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-navy-600">{f.body}</p>
        </div>
      ))}
    </div>
  );
}

export function Section({ title, intro, children, muted }: { title?: string; intro?: string; children: React.ReactNode; muted?: boolean }) {
  return (
    <section className={muted ? "bg-white/35 backdrop-blur-[1px]" : ""}>
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        {title && <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>}
        {intro && <p className="mt-2 max-w-2xl text-navy-600">{intro}</p>}
        <div className={title || intro ? "mt-8" : ""}>{children}</div>
      </div>
    </section>
  );
}

export function CtaBand({ title, body, href, label }: { title: string; body: string; href: string; label: string }) {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
      <div className="flex flex-col items-start justify-between gap-6 iridescent-dark rounded-[2rem] px-8 py-10 shadow-[var(--shadow-float)] sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          <p className="mt-1 text-forest-100/80">{body}</p>
        </div>
        <Button asChild size="lg" variant="accent">
          <Link href={href}>{label}</Link>
        </Button>
      </div>
    </section>
  );
}

export function Prose({ children }: { children: React.ReactNode }) {
  return <div className="prose-ai mx-auto max-w-3xl space-y-4 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-navy-900">{children}</div>;
}
