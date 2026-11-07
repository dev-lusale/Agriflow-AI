import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { PhoneOverview } from "@/components/marketing/phone-mockups";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh gap-3 p-3 lg:grid-cols-[1.05fr_1fr]">
      <aside className="iridescent relative hidden overflow-hidden rounded-[2.25rem] border border-white/80 p-10 shadow-[var(--shadow-float)] lg:flex lg:flex-col">
        <Link href="/" className="w-fit transition-opacity hover:opacity-80">
          <Logo />
        </Link>
        <div className="mt-10 max-w-md">
          <p className="text-sm font-medium text-navy-500">AgriFlow AI Zambia</p>
          <h2 className="mt-1 text-4xl font-semibold leading-[1.08]">Grow smarter. Trade better. Harvest more.</h2>
          <ul className="mt-6 space-y-2.5 text-[0.95rem] text-navy-600">
            {["Farm records that work offline", "Grok advice from your own farm data", "Sell produce, buy inputs, book transport", "Profit by crop and field, in Kwacha"].map((t) => (
              <li key={t} className="flex gap-2.5">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-forest-600" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="pointer-events-none absolute -bottom-24 right-8 rotate-[-6deg] scale-90 opacity-95 xl:right-16">
          <PhoneOverview />
        </div>
      </aside>
      <main className="flex flex-col rounded-[2.25rem] px-2 py-6 sm:px-8">
        <Link href="/" className="w-fit lg:hidden">
          <Logo />
        </Link>
        <div className="glass mx-auto my-auto w-full max-w-md animate-fade-up rounded-[2rem] p-6 shadow-[var(--shadow-lift)] sm:p-8">{children}</div>
      </main>
    </div>
  );
}
