import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CalendarDays,
  Camera,
  CheckCircle2,
  CloudSun,
  HeartPulse,
  LineChart,
  ShieldCheck,
  ShoppingBasket,
  Sprout,
  Store,
  Tractor,
  Truck,
  Wallet,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { ListingCard } from "@/components/marketplace/listing-card";
import { prisma } from "@/lib/db";
import { listingCardInclude } from "@/server/marketplace/service";
import { FaqList, HOME_FAQ } from "./faq-data";

export const revalidate = 300;

async function liveData() {
  try {
    const [listings, farmers, farms, activeListings] = await Promise.all([
      prisma.produceListing.findMany({ where: { status: "ACTIVE", moderationStatus: { not: "REMOVED" }, quantityAvailable: { gt: 0 } }, orderBy: { createdAt: "desc" }, take: 4, include: listingCardInclude }),
      prisma.user.count({ where: { role: "FARMER", status: "ACTIVE" } }),
      prisma.farm.count(),
      prisma.produceListing.count({ where: { status: "ACTIVE" } }),
    ]);
    return { listings, farmers, farms, activeListings, demo: listings.some((l) => l.isDemo) };
  } catch {
    return { listings: [], farmers: 0, farms: 0, activeListings: 0, demo: false };
  }
}

export default async function HomePage() {
  const live = await liveData();
  return (
    <>
      {/* ───────── Hero ───────── */}
      <section className="relative overflow-hidden bg-forest-900">
        <HeroBackdrop />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.05fr_1fr] lg:px-8">
          <div>
            <Badge tone="green" className="bg-white/10 text-forest-100 ring-white/20">
              <Sprout className="size-3.5" /> Built for Zambian agriculture · Powered by Grok
            </Badge>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] text-white sm:text-5xl lg:text-[3.4rem]">
              Grow smarter. <span className="text-forest-300">Trade better.</span> Harvest more.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-forest-100/85">
              AgriFlow AI puts farm records, crop advice, weather, buyers, input suppliers, transport and farm finances in one app. It works on any smartphone and keeps working when the network drops.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" variant="accent">
                <Link href="/auth/register?role=FARMER">
                  Register as a farmer <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                <Link href="/marketplace">
                  <ShoppingBasket /> Explore the marketplace
                </Link>
              </Button>
            </div>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-white/10 pt-6">
              {[
                [live.farmers, "farmers"],
                [live.farms, "farms registered"],
                [live.activeListings, "live listings"],
              ].map(([n, l]) => (
                <div key={String(l)}>
                  <dt className="text-xs text-forest-200/70">{l}</dt>
                  <dd className="text-2xl font-bold text-white">{Number(n).toLocaleString("en-ZM")}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-[11px] text-forest-200/60">Live counts from this deployment{live.demo ? " (includes fictional demo accounts)" : ""}.</p>
          </div>
          <HeroPreview />
        </div>
      </section>

      {/* ───────── Problem ───────── */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-forest-600">The problem</p>
            <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Farming in Zambia runs on scattered tools and guesswork.</h2>
            <p className="mt-4 text-navy-600">
              Advice, buyers, inputs, transport and records all sit in different places: phone calls, notebooks, middlemen and word of mouth. Each gap costs farmers yield, time and income.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { t: "Advice is hard to reach", d: "Few extension officers per farmer, and diseases or pests such as fall armyworm are spotted too late.", i: HeartPulse },
              { t: "Markets are opaque", d: "Farmers sell to the first buyer who arrives, without seeing demand or fair prices elsewhere.", i: Store },
              { t: "Inputs and transport are uncoordinated", d: "Seed, fertilizer and trucks are arranged by phone, often late and at higher cost.", i: Truck },
              { t: "Profit is invisible", d: "Without records, farmers cannot tell which crop or field actually makes money.", i: Wallet },
            ].map((p) => (
              <div key={p.t} className="rounded-2xl border border-border bg-navy-50/50 p-5">
                <p.i className="size-6 text-forest-600" />
                <p className="mt-3 font-semibold">{p.t}</p>
                <p className="mt-1 text-sm text-navy-600">{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Features ───────── */}
      <section className="bg-navy-50/70 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-forest-600">One connected ecosystem</p>
            <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Everything a farm business needs, from planting to payment.</h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.t} className="rounded-2xl border border-border bg-white p-5 shadow-[var(--shadow-card)]">
                <div className="flex size-10 items-center justify-center rounded-xl bg-forest-50 text-forest-700">
                  <f.i className="size-5" />
                </div>
                <p className="mt-4 font-semibold">{f.t}</p>
                <p className="mt-1 text-sm leading-relaxed text-navy-600">{f.d}</p>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <Button asChild variant="outline">
              <Link href="/features">
                See all features <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ───────── AI demo ───────── */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-forest-600">Grok agricultural intelligence</p>
            <h2 className="mt-2 text-3xl font-bold sm:text-4xl">An advisor that knows your farm, not just farming.</h2>
            <p className="mt-4 text-navy-600">
              The AgriFlow AI Assistant runs on Grok by xAI and reads the farmer&apos;s own records: location, crops, planting dates, activities, weather and finances. Every figure comes from AgriFlow&apos;s database, never made up by the AI.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-navy-700">
              {[
                "Crop health checks from a photo, with an honest confidence level and when to call an expert",
                "Profit questions answered from your recorded income and expenses",
                "Weather-aware advice from a real forecast provider, with the source and time shown",
                "Suggested tasks you approve before anything is added to your calendar",
              ].map((x) => (
                <li key={x} className="flex gap-2.5">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-forest-500" />
                  {x}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-border bg-white p-4 shadow-[var(--shadow-lift)] sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-forest-800 text-white">
                  <Bot className="size-4" />
                </span>
                <span className="text-sm font-semibold">AgriFlow AI Assistant</span>
              </div>
              <Badge tone="slate">Example conversation</Badge>
            </div>
            <div className="space-y-3 text-sm">
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-forest-800 px-4 py-2.5 text-white">My maize in Choma has yellow lower leaves. What should I do?</div>
              <div className="max-w-[92%] rounded-2xl rounded-bl-sm bg-navy-50 px-4 py-3 text-navy-800">
                <p>Your records show <strong>5 ha of SC 513 maize planted 2 December</strong>, now about 5 weeks old, and no top-dressing recorded yet.</p>
                <p className="mt-2">Yellowing that starts at the tip of lower leaves in a V shape usually points to <strong>nitrogen deficiency</strong>, which is common around top-dressing time.</p>
                <p className="mt-2 text-xs text-navy-500">Uncertain: other causes such as waterlogging or streak virus look similar. A photo check or a visit from your camp officer can confirm.</p>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="inline-flex items-center gap-1 rounded-full border border-forest-200 bg-forest-50 px-3 py-1 text-xs font-medium text-forest-800">
                  <CalendarDays className="size-3.5" /> Suggested task: Top-dress with urea (in 3 days)
                </span>
              </div>
            </div>
            <p className="mt-4 border-t border-border pt-3 text-xs text-navy-500">Illustrative example. Real answers use your own data and the configured Grok model.</p>
          </div>
        </div>
      </section>

      {/* ───────── How it works ───────── */}
      <section className="bg-forest-900 py-20 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">How it works</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-4">
            {[
              ["Register your farm", "Add farms, fields and crops in minutes. Progressive onboarding asks only what is needed."],
              ["Record & get advice", "Log activities, even offline. Ask Grok about crops, pests, weather and money."],
              ["Sell & buy", "List produce for verified buyers, negotiate prices and order inputs from suppliers."],
              ["Deliver & get paid", "Book transporters, track delivery status, and watch profit update automatically."],
            ].map(([t, d], i) => (
              <div key={t} className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
                <span className="flex size-9 items-center justify-center rounded-full bg-forest-500 text-sm font-bold">{i + 1}</span>
                <p className="mt-4 font-semibold">{t}</p>
                <p className="mt-1 text-sm text-forest-100/75">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Benefits ───────── */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-forest-600">Benefits for Zambian farmers</p>
            <h2 className="mt-2 text-3xl font-bold">Designed for the field, not the office.</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:col-span-2">
            {[
              { i: WifiOff, t: "Works with poor signal", d: "Record activities, notes and tasks offline. They sync automatically, with clear status so nothing is lost." },
              { i: ShieldCheck, t: "Your data stays yours", d: "Role-based access, server-side checks and consent-first data handling. The AI only sees your own records." },
              { i: LineChart, t: "Know your profit", d: "Income and costs by crop, field and month, calculated exactly in Kwacha. Actual figures are kept apart from estimates." },
              { i: CloudSun, t: "Local, honest information", d: "Real forecast data with source and time shown. Market prices are labelled verified, user-submitted or demo." },
            ].map((b) => (
              <div key={b.t} className="flex gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-forest-50 text-forest-700">
                  <b.i className="size-5" />
                </div>
                <div>
                  <p className="font-semibold">{b.t}</p>
                  <p className="mt-1 text-sm leading-relaxed text-navy-600">{b.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Marketplace preview ───────── */}
      <section className="bg-navy-50/70 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-forest-600">Marketplace</p>
              <h2 className="mt-2 text-3xl font-bold">Fresh listings from Zambian farms</h2>
            </div>
            <Button asChild variant="outline">
              <Link href="/marketplace">
                Browse all produce <ArrowRight />
              </Link>
            </Button>
          </div>
          {live.listings.length ? (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {live.listings.map((l) => (
                <ListingCard key={l.id} listing={l} href={`/marketplace/${l.id}`} />
              ))}
            </div>
          ) : (
            <p className="mt-8 rounded-2xl border border-dashed border-navy-200 bg-white p-8 text-center text-sm text-navy-500">No listings yet. Farmers can add the first one after registering.</p>
          )}
        </div>
      </section>

      {/* ───────── Testimonials ───────── */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <h2 className="text-3xl font-bold">What users could say</h2>
          <Badge tone="amber">Demo content · fictional people</Badge>
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {[
            ["Before, I sold my maize to whoever came to the farm. Now I can see buyers in Lusaka and agree a price before the truck arrives.", "Mutale B.", "Maize farmer, Mkushi (fictional)"],
            ["Recording fertilizer and labour costs showed me my groundnuts were more profitable than I thought.", "Grace N.", "Smallholder, Chipata (fictional)"],
            ["We find aggregated soybean lots by district and quality grade, and delivery status is visible to everyone.", "Lusaka Grain Traders", "Buyer (fictional)"],
          ].map(([q, n, r]) => (
            <figure key={n} className="rounded-2xl border border-border bg-white p-6 shadow-[var(--shadow-card)]">
              <blockquote className="text-navy-700">&ldquo;{q}&rdquo;</blockquote>
              <figcaption className="mt-4 text-sm">
                <span className="font-semibold text-navy-900">{n}</span>
                <span className="block text-navy-500">{r}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ───────── FAQ ───────── */}
      <section className="bg-navy-50/70 py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-bold">Frequently asked questions</h2>
          <div className="mt-8">
            <FaqList items={HOME_FAQ} />
          </div>
          <p className="mt-6 text-center text-sm">
            <Link href="/faq" className="font-semibold text-forest-700 hover:underline">
              More questions →
            </Link>
          </p>
        </div>
      </section>

      {/* ───────── CTA ───────── */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-forest-800 px-6 py-14 text-center sm:px-12">
          <HeroBackdrop />
          <div className="relative">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">Ready for a better season?</h2>
            <p className="mx-auto mt-3 max-w-xl text-forest-100/85">Create a free account as a farmer, buyer, input supplier or transporter.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" variant="accent">
                <Link href="/auth/register">Create your account</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white">
                <Link href="/how-it-works">See how it works</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

const FEATURES = [
  { i: Tractor, t: "Farm management", d: "Farms, fields, crops, activities, calendar and inventory in one place." },
  { i: Bot, t: "Grok AI assistant", d: "Plain-language answers using your crops, location and records." },
  { i: Camera, t: "Crop health checks", d: "Photograph a problem and get likely causes, next steps and safety notes." },
  { i: CloudSun, t: "Weather intelligence", d: "7-day forecast for your farm, with rule-based alerts and AI explanations." },
  { i: Store, t: "Produce marketplace", d: "List produce, receive requests, negotiate and confirm orders." },
  { i: ShoppingBasket, t: "Input supply", d: "Compare seed, fertilizer and equipment from suppliers, with safety information." },
  { i: Truck, t: "Logistics", d: "Request transport and track pickup, transit and proof of delivery." },
  { i: Wallet, t: "Farm finances", d: "Income, costs and profit by crop and field, exportable to CSV and PDF." },
];

function HeroBackdrop() {
  return (
    <svg className="pointer-events-none absolute inset-0 size-full opacity-[0.16]" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <pattern id="rows" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(-18)">
          <line x1="0" y1="0" x2="0" y2="22" stroke="#4fa572" strokeWidth="1.2" />
        </pattern>
      </defs>
      <path d="M0 420 Q300 340 600 400 T1200 380 V600 H0Z" fill="url(#rows)" />
      <path d="M0 500 Q350 440 700 490 T1200 470 V600 H0Z" fill="#16A34A" opacity="0.5" />
      <circle cx="1040" cy="110" r="70" fill="#f59e0b" opacity="0.35" />
    </svg>
  );
}

function HeroPreview() {
  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none" aria-label="Product preview">
      <div className="rounded-3xl bg-white p-4 shadow-2xl ring-1 ring-black/5 sm:p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-navy-500">Kabwe Valley Farm · Central</p>
            <p className="font-semibold">Season overview</p>
          </div>
          <Badge tone="amber">Product preview</Badge>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            ["Income", "K 86,400", "text-forest-700"],
            ["Costs", "K 41,250", "text-navy-800"],
            ["Net", "K 45,150", "text-forest-700"],
          ].map(([l, v, c]) => (
            <div key={l} className="rounded-xl bg-navy-50 p-3">
              <p className="text-[11px] text-navy-500">{l}</p>
              <p className={`text-sm font-bold ${c}`}>{v}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex h-24 items-end gap-1.5 rounded-xl bg-navy-50 p-3">
          {[35, 52, 44, 70, 62, 85, 78, 92].map((h, i) => (
            <div key={i} className="flex-1 rounded-t bg-forest-500/80" style={{ height: `${h}%` }} />
          ))}
        </div>
        <div className="mt-3 space-y-2">
          {[
            ["Maize · Field A", "Vegetative · 5 wks", "blue"],
            ["Soybeans · Field B", "Flowering", "green"],
          ].map(([a, b, t]) => (
            <div key={a} className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm">
              <span className="font-medium">{a}</span>
              <Badge tone={t as "blue" | "green"}>{b}</Badge>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute -bottom-6 -left-4 hidden w-60 rounded-2xl bg-white p-3 shadow-xl ring-1 ring-black/5 sm:block">
        <div className="flex items-center gap-2 text-xs font-semibold text-forest-800">
          <CloudSun className="size-4 text-harvest-600" /> 7-day outlook
        </div>
        <p className="mt-1 text-xs text-navy-600">Heavy rain likely on Thursday. Hold off top-dressing until it passes.</p>
      </div>
    </div>
  );
}
