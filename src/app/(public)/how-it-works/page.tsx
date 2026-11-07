import type { Metadata } from "next";
import { CtaBand, MarketingHero, Section } from "@/components/layout/marketing";

export const metadata: Metadata = { title: "How it works" };

const FLOWS = [
  {
    who: "Farmers",
    steps: [
      ["Register & onboard", "Choose 'Farmer', add your province, district, main crops and first farm."],
      ["Map your farm", "Divide farms into fields and add crop records with variety, planting date and expected harvest."],
      ["Record as you work", "Log activities and costs, even offline. The calendar reminds you of tasks and harvests."],
      ["Ask AgriFlow AI", "Get advice that uses your own records, check crop health from a photo, and generate reports."],
      ["Sell & get paid", "List produce, respond to purchase requests, arrange delivery and watch your profit update."],
    ],
  },
  {
    who: "Buyers",
    steps: [
      ["Find produce", "Search by crop, location, price and quantity, and see the farmer's verification status."],
      ["Request & negotiate", "Send a purchase request or a price offer, then exchange counteroffers in the order thread."],
      ["Confirm & track", "Confirm the agreed deal to reserve stock, book transport and follow delivery status."],
      ["Complete", "Confirm receipt to complete the order, and download your purchase history."],
    ],
  },
  {
    who: "Suppliers & transporters",
    steps: [
      ["List products or services", "Suppliers add inputs with stock and safety data. Transporters add vehicles, capacity and service provinces."],
      ["Receive work", "Get notified about purchase orders and delivery requests in your area."],
      ["Fulfil & update", "Move orders through processing and dispatch, or update a delivery from pickup to proof of delivery."],
    ],
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <MarketingHero eyebrow="How it works" title="From field to buyer in one connected flow" intro="Each role has its own dashboard, but they all share the same orders, deliveries and notifications, so everyone sees the same status." cta={{ href: "/auth/register", label: "Get started" }} />
      {FLOWS.map((f, i) => (
        <Section key={f.who} title={f.who} muted={i % 2 === 1}>
          <ol className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            {f.steps.map(([t, d], j) => (
              <li key={t} className="glass rounded-[1.75rem] p-5 shadow-[var(--shadow-card)]">
                <span className="flex size-8 items-center justify-center rounded-full bg-ink text-sm font-bold text-white">{j + 1}</span>
                <p className="mt-3 font-semibold">{t}</p>
                <p className="mt-1 text-sm text-navy-600">{d}</p>
              </li>
            ))}
          </ol>
        </Section>
      ))}
      <Section title="Order lifecycle">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {["Pending", "Accepted", "Confirmed", "Processing", "Ready for pickup", "In transit", "Delivered", "Completed"].map((s, i, a) => (
            <span key={s} className="flex items-center gap-2">
              <span className="rounded-full bg-forest-50 px-3 py-1 font-medium text-forest-800 ring-1 ring-forest-200">{s}</span>
              {i < a.length - 1 && <span className="text-navy-300">→</span>}
            </span>
          ))}
        </div>
        <p className="mt-4 max-w-2xl text-sm text-navy-600">Orders can be negotiated before acceptance, cancelled with a reason, or disputed after delivery for an administrator to resolve. Stock is reserved only when the buyer confirms.</p>
      </Section>
      <CtaBand title="Try a demo account" body="Explore every role with fictional sample data." href="/auth/login" label="Sign in to a demo" />
    </>
  );
}
