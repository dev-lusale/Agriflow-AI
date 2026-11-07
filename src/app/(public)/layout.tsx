import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { PublicHeader } from "@/components/layout/public-header";
import { getCurrentUser } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/auth/roles";
import { env } from "@/lib/env";
import { getSetting } from "@/server/admin/settings";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [user, banner] = await Promise.all([getCurrentUser().catch(() => null), getSetting<string>("platform.maintenanceBanner", "")]);
  return (
    <div className="flex min-h-dvh flex-col">
      {env.demoMode && (
        <div className="bg-harvest-500 px-3 py-1 text-center text-xs font-semibold text-navy-900">
          DEMO MODE · This deployment uses fictional sample data for demonstration. <Link href="/auth/login" className="underline">Try a demo account</Link>
        </div>
      )}
      {banner ? <div role="status" className="bg-sky-50 px-3 py-1.5 text-center text-sm text-sky-900">{banner}</div> : null}
      <PublicHeader signedInHome={user ? ROLE_HOME[user.role] : null} />
      <main className="flex-1">{children}</main>
      <footer className="bg-navy-900 text-navy-300">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)] lg:px-8">
          <div>
            <Logo inverted />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-navy-400">
              Grow Smarter. Trade Better. Harvest More. An AI-powered agricultural ecosystem built for Zambian farmers and agribusinesses.
            </p>
            <p className="mt-4 text-xs text-navy-500">AI assistance powered by Grok (xAI). Weather data by Open-Meteo.</p>
          </div>
          <FooterCol title="Platform" links={[["Features", "/features"], ["How it works", "/how-it-works"], ["Marketplace", "/marketplace"], ["Input suppliers", "/suppliers"], ["Logistics", "/logistics"]]} />
          <FooterCol title="Company" links={[["About", "/about"], ["For farmers", "/farmers"], ["FAQ", "/faq"], ["Contact", "/contact"]]} />
          <FooterCol title="Legal" links={[["Privacy notice", "/privacy"], ["Terms of use", "/terms"]]} />
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-navy-500 sm:flex-row sm:justify-between sm:px-6 lg:px-8">
            <p>© {new Date().getFullYear()} AgriFlow AI Zambia. Hackathon prototype.</p>
            <p>Prices in Zambian Kwacha (ZMW). AI guidance is advisory; verify with an extension officer.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="text-sm font-semibold text-white">{title}</p>
      <ul className="mt-4 space-y-2.5 text-sm">
        {links.map(([l, h]) => (
          <li key={h}>
            <Link href={h} className="hover:text-white">
              {l}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
