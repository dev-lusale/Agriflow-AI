import type { Metadata } from "next";
import { Bot, CalendarDays, Camera, CloudSun, Smartphone, Wallet } from "lucide-react";
import { CtaBand, FeatureGrid, MarketingHero, Section } from "@/components/layout/marketing";

export const metadata: Metadata = { title: "For farmers" };

export default function FarmersPage() {
  return (
    <>
      <MarketingHero
        eyebrow="For farmers"
        title="Your farm office, advisor and market, in your pocket"
        intro="Whether you farm two hectares of maize in Choma or run a commercial soybean operation in Mkushi, AgriFlow AI helps you plan, record, sell and understand your profit."
        cta={{ href: "/auth/register?role=FARMER", label: "Register as a farmer" }}
      />
      <Section>
        <FeatureGrid
          items={[
            { icon: CalendarDays, title: "Never miss a task", body: "Planting, top-dressing, spraying and harvest reminders on one calendar, with system reminders created from your crop records." },
            { icon: Bot, title: "Advice in plain language", body: "Ask 'When should I plant maize?' or 'How do I store my harvest?' and get step-by-step answers that consider your district and crops." },
            { icon: Camera, title: "Spot problems early", body: "Photograph yellowing leaves or pest damage. You get likely causes, a confidence level and safe next steps, saved so you can compare over time." },
            { icon: CloudSun, title: "Plan around the weather", body: "Forecasts for your farm location, with alerts for heavy rain, dry spells, heat and wind." },
            { icon: Wallet, title: "Know what you earn", body: "Record expenses and sales, and see profit by crop and field. Sales completed on the marketplace post automatically." },
            { icon: Smartphone, title: "Made for phones", body: "Install it like an app, use it with a weak signal, and keep working offline in the field." },
          ]}
        />
      </Section>
      <CtaBand title="Start this season with better records" body="Free to register. Takes about two minutes." href="/auth/register?role=FARMER" label="Register now" />
    </>
  );
}
