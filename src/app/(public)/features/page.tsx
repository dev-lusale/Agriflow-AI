import type { Metadata } from "next";
import { BarChart3, Bell, Bot, Boxes, CalendarDays, Camera, CloudSun, FileText, Handshake, MessageSquare, ShieldCheck, ShoppingBasket, Store, Tractor, Truck, Wallet, WifiOff } from "lucide-react";
import { CtaBand, FeatureGrid, MarketingHero, Section } from "@/components/layout/marketing";

export const metadata: Metadata = { title: "Features" };

export default function FeaturesPage() {
  return (
    <>
      <MarketingHero eyebrow="Features" title="One platform for the whole agricultural value chain" intro="AgriFlow AI joins farm management, Grok-powered intelligence, trade, logistics and finance, so information flows between them instead of being re-typed." cta={{ href: "/auth/register", label: "Create a free account" }} />
      <Section title="Farm management">
        <FeatureGrid
          items={[
            { icon: Tractor, title: "Farms & fields", body: "Register several farms with Zambian province and district selectors, optional GPS, and field-level soil and irrigation details." },
            { icon: CalendarDays, title: "Crops, activities & calendar", body: "Track variety, planting date, growth stage and harvest for each crop. Log land preparation, fertilizer, spraying and harvest with quantities and costs." },
            { icon: Boxes, title: "Inventory", body: "Seed, fertilizer, chemicals and harvested stock, with movement history, low-stock alerts and valuation. Stock cannot go negative unless you record an authorised adjustment." },
          ]}
        />
      </Section>
      <Section title="Grok agricultural intelligence" muted>
        <FeatureGrid
          items={[
            { icon: Bot, title: "AgriFlow AI Assistant", body: "Conversational advice that takes your crops, location, activities, weather and finances into account. It asks clarifying questions and says when it is uncertain." },
            { icon: Camera, title: "Crop health assessment", body: "Upload a photo and describe symptoms to get likely issues, a confidence level, next steps, prevention and whether an expert should inspect. Every assessment is saved for comparison." },
            { icon: FileText, title: "AI farm reports", body: "Weekly, monthly, crop performance, expense, harvest and profitability reports. The backend computes the figures and Grok explains them. Export to PDF." },
            { icon: CloudSun, title: "Weather intelligence", body: "Real forecasts from Open-Meteo with the source and fetch time shown, rule-based alerts for heavy rain, dry spells, heat and wind, and an AI explanation on request." },
            { icon: BarChart3, title: "Profitability advisor", body: "Ask which crop is most profitable or how much you spent on fertilizer. Answers come from your recorded transactions, never estimated by the AI." },
            { icon: ShieldCheck, title: "Safe by design", body: "Server-side AI calls, rate limits, prompt-injection defences, usage logging, and no ability for the AI to change records or move money." },
          ]}
        />
      </Section>
      <Section title="Trade & logistics">
        <FeatureGrid
          items={[
            { icon: Store, title: "Produce marketplace", body: "Search and filter by crop, province, district, price and quantity. Listings show quality grade, harvest date and farmer verification." },
            { icon: Handshake, title: "Orders & negotiation", body: "Purchase requests, counteroffers with full history, and a clear order lifecycle from pending to completed, with disputes and cancellation." },
            { icon: ShoppingBasket, title: "Input supply", body: "Suppliers list seed, fertilizer, crop protection and equipment with stock levels and safety information. Farmers compare products and order." },
            { icon: Truck, title: "Delivery management", body: "Request transport, let transporters accept jobs, track pickup and transit, and record proof of delivery. The design is ready for maps and route optimisation." },
            { icon: Wallet, title: "Farm finances", body: "Income and expenses by crop, field and month. Completed sales and input purchases post automatically. CSV and PDF export." },
            { icon: MessageSquare, title: "Messaging & notifications", body: "Secure in-app messaging between buyers and farmers, plus in-app notifications with per-type preferences. SMS and WhatsApp channels are designed in but not yet connected." },
          ]}
        />
      </Section>
      <Section title="Built for real conditions" muted>
        <FeatureGrid
          cols={3}
          items={[
            { icon: WifiOff, title: "Offline-first PWA", body: "Install on Android or iPhone. Record activities, notes and tasks without a signal. Every item shows whether it is saved locally, syncing, synced or failed." },
            { icon: Bell, title: "Admin oversight", body: "Administrators verify accounts, moderate listings, manage crops and regions, record verified market prices, and review audit logs." },
            { icon: ShieldCheck, title: "Privacy & consent", body: "Consent is recorded at sign-up. We collect only the data we need. The design is ready for review under Zambia's Data Protection Act, 2021." },
          ]}
        />
      </Section>
      <CtaBand title="See it with your own farm" body="Registration takes about two minutes." href="/auth/register" label="Get started" />
    </>
  );
}
