import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden overflow-hidden bg-forest-900 p-12 text-white lg:flex lg:flex-col">
        <Link href="/">
          <Logo inverted />
        </Link>
        <div className="my-auto max-w-md">
          <h2 className="text-3xl font-bold leading-tight text-white">Grow Smarter. Trade Better. Harvest More.</h2>
          <ul className="mt-8 space-y-4 text-forest-100/85">
            {["Farm records, calendar and inventory that work offline", "Grok-powered advice based on your own farm data", "Sell produce, buy inputs and book transport in one place", "Profit by crop and field, in Kwacha"].map((t) => (
              <li key={t} className="flex gap-3">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-forest-400" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <svg className="pointer-events-none absolute -bottom-10 left-0 w-full opacity-20" viewBox="0 0 600 200" aria-hidden="true">
          <path d="M0 120 Q150 70 300 110 T600 100 V200 H0Z" fill="#16A34A" />
          <path d="M0 160 Q200 120 380 150 T600 140 V200 H0Z" fill="#4fa572" />
        </svg>
      </aside>
      <main className="flex flex-col bg-white px-4 py-8 sm:px-8">
        <Link href="/" className="lg:hidden">
          <Logo />
        </Link>
        <div className="mx-auto my-auto w-full max-w-md py-10">{children}</div>
      </main>
    </div>
  );
}
