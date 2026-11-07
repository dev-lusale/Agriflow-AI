import type { Metadata } from "next";
import { MarketingHero, Section } from "@/components/layout/marketing";
import { FaqList, FULL_FAQ } from "../faq-data";

export const metadata: Metadata = { title: "FAQ" };

export default function FaqPage() {
  return (
    <>
      <MarketingHero eyebrow="Help" title="Frequently asked questions" intro="Answers for farmers, buyers, suppliers and transporters. Can't find what you need? Contact us." cta={{ href: "/contact", label: "Contact us" }} />
      <Section>
        <div className="mx-auto max-w-3xl space-y-10">
          {FULL_FAQ.map((g) => (
            <div key={g.group}>
              <h2 className="mb-4 text-lg font-semibold">{g.group}</h2>
              <FaqList items={g.items} />
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
