import type { Metadata } from "next";
import { HeartHandshake, Lightbulb, ShieldCheck, Target } from "lucide-react";
import { CtaBand, FeatureGrid, MarketingHero, Section } from "@/components/layout/marketing";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <>
      <MarketingHero
        eyebrow="About AgriFlow AI"
        title="Empowering Zambian farmers and agribusinesses with AI"
        intro="Our mission is to give every Zambian farmer the information, markets and business tools that were once only available to large commercial operations, through one simple app."
      />
      <Section title="Why we exist">
        <div className="grid gap-8 lg:grid-cols-2">
          <p className="text-navy-700 leading-relaxed">
            Agriculture employs a large share of Zambia&apos;s workforce, and most farmers are smallholders. They face the same challenges again and again: scarce extension advice, pests and diseases spotted late, unpredictable rains, weak market access, informal record keeping and uncoordinated transport. Each problem is solvable on its own. Together they make farming risky and leave money in the hands of middlemen.
          </p>
          <p className="text-navy-700 leading-relaxed">
            AgriFlow AI connects these pieces. A farmer&apos;s records feed the AI advisor. The advisor helps the crop, the crop becomes a marketplace listing, and the listing becomes an order, a delivery and a line in the farm&apos;s profit report. Buyers, suppliers and transporters join the same flow, and administrators see the ecosystem as a whole.
          </p>
        </div>
      </Section>
      <Section title="Our principles" muted>
        <FeatureGrid
          cols={2}
          items={[
            { icon: Target, title: "Useful before impressive", body: "Every feature must save a farmer time or money. We favour reliable, simple workflows over flashy features." },
            { icon: Lightbulb, title: "Honest intelligence", body: "AI explains and advises. It never invents prices, weather or figures, and it says when a diagnosis is uncertain." },
            { icon: ShieldCheck, title: "Farmers own their data", body: "Minimal data collection, explicit consent, strict access control, and no selling of personal data." },
            { icon: HeartHandshake, title: "Built with the ecosystem", body: "We aim to work alongside extension services, cooperatives, agro-dealers and transporters, not replace them." },
          ]}
        />
      </Section>
      <Section title="Status">
        <p className="max-w-3xl text-navy-700">
          AgriFlow AI Zambia began as a hackathon project in the Agriculture &amp; Agribusiness challenge. The platform is functional end to end, but it has not yet been certified or independently audited. Demonstration deployments use clearly labelled fictional data.
        </p>
      </Section>
      <CtaBand title="Join the pilot" body="Farmers, buyers, suppliers and transporters are welcome." href="/auth/register" label="Create an account" />
    </>
  );
}
