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
import { PhoneOverview, PhoneTrio } from "@/components/marketing/phone-mockups";

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
      <section className="relative overflow-hidden">
        <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-12 sm:px-6 md:pt-20 lg:px-8">
          <div className="mx-auto max-w-3xl animate-fade-up text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3.5 py-1.5 text-sm font-medium text-navy-600 shadow-sm ring-1 ring-black/[0.03] backdrop-blur">
              <Sprout className="size-4 text-forest-600" /> Built for Zambian agriculture · Powered by Grok
            </span>
            <h1 className="mt-6 text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.03em] sm:text-6xl lg:text-[4.4rem]">
              Grow smarter.
              <br />
              <span className="text-navy-400">Trade better.</span> Harvest more.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-navy-500">
              Farm records, crop advice, weather, buyers, inputs, transport and finances in one calm, simple app. It works on any smartphone, even when the network drops.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/auth/register?role=FARMER">
                  Register as a farmer <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/marketplace">
                  <ShoppingBasket /> Explore the marketplace
                </Link>
              </Button>
            </div>
            <dl className="stagger mx-auto mt-10 flex max-w-md justify-center divide-x divide-navy-200/70 rounded-full bg-white/60 px-2 py-3 shadow-sm ring-1 ring-black/[0.03] backdrop-blur">
              {[
                [live.farmers, "farmers"],
                [live.farms, "farms"],
                [live.activeListings, "live listings"],
              ].map(([n, l]) => (
                <div key={String(l)} className="flex-1 px-4">
                  <dd className="num text-2xl font-light text-navy-900">{Number(n).toLocaleString("en-ZM")}</dd>
                  <dt className="text-xs text-navy-500">{l}</dt>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-[11px] text-navy-400">Live counts from this deployment{live.demo ? " (includes fictional demo accounts)" : ""}.</p>
          </div>
          <div className="relative mt-14 hidden animate-fade-up [animation-delay:150ms] md:block">
            <PhoneTrio />
            <p className="mt-4 text-center text-xs text-navy-400">Product preview · illustrative screens</p>
          </div>
          <div className="mt-12 flex justify-center animate-fade-up md:hidden">
            <PhoneOverview />
          </div>
        </div>
      </section>

      {/* ───────── Problem ───────── */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <p className="text-sm font-medium text-navy-500">The problem</p>
            <h2 className="mt-2 text-3xl font-semibold sm:text-[2.6rem] sm:leading-[1.1]">Farming in Zambia runs on scattered tools and guesswork.</h2>
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
      <section className="bg-white/35 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-navy-500">One connected ecosystem</p>
            <h2 className="mt-2 text-3xl font-semibold sm:text-[2.6rem] sm:leading-[1.1]">Everything a farm business needs, from planting to payment.</h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.t} className="glass rounded-[1.75rem] p-5 shadow-[var(--shadow-card)]">
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
            <p className="text-sm font-medium text-navy-500">Grok agricultural intelligence</p>
            <h2 className="mt-2 text-3xl font-semibold sm:text-[2.6rem] sm:leading-[1.1]">An advisor that knows your farm, not just farming.</h2>
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
          <div className="glass rounded-[2rem] p-4 shadow-[var(--shadow-lift)] sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-ink text-white">
                  <Bot className="size-4" />
                </span>
                <span className="text-sm font-semibold">AgriFlow AI Assistant</span>
              </div>
              <Badge tone="slate">Example conversation</Badge>
            </div>
            <div className="space-y-3 text-sm">
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-white">My maize in Choma has yellow lower leaves. What should I do?</div>
              <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-white px-4 py-3 text-navy-800 shadow-sm ring-1 ring-black/[0.03]">
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
      <section className="px-3 py-6 sm:px-4">
        <div className="iridescent-dark mx-auto max-w-7xl rounded-[2.5rem] px-5 py-16 text-white shadow-[var(--shadow-float)] sm:px-10">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">How it works</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-4">
            {[
              ["Register your farm", "Add farms, fields and crops in minutes. Progressive onboarding asks only what is needed."],
              ["Record & get advice", "Log activities, even offline. Ask Grok about crops, pests, weather and money."],
              ["Sell & buy", "List produce for verified buyers, negotiate prices and order inputs from suppliers."],
              ["Deliver & get paid", "Book transporters, track delivery status, and watch profit update automatically."],
            ].map(([t, d], i) => (
              <div key={t} className="rounded-[1.5rem] bg-white/[0.06] p-5 ring-1 ring-white/10 backdrop-blur transition hover:bg-white/[0.1]">
                <span className="flex size-9 items-center justify-center rounded-full bg-white text-sm font-bold text-ink">{i + 1}</span>
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
            <p className="text-sm font-medium text-navy-500">Benefits for Zambian farmers</p>
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
      <section className="bg-white/35 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-medium text-navy-500">Marketplace</p>
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
            <figure key={n} className="glass rounded-[1.75rem] p-6 shadow-[var(--shadow-card)]">
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
      <section className="bg-white/35 py-20">
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
        <div className="iridescent relative overflow-hidden rounded-[2.5rem] border border-white/80 px-6 py-16 text-center shadow-[var(--shadow-float)] sm:px-12">
          <div className="relative">
            <h2 className="text-3xl font-semibold sm:text-5xl">Ready for a better season?</h2>
            <p className="mx-auto mt-3 max-w-xl text-navy-600">Create a free account as a farmer, buyer, input supplier or transporter.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/auth/register">Create your account</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
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


