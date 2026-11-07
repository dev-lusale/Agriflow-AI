import type { Metadata } from "next";
import { MarketingHero, Prose, Section } from "@/components/layout/marketing";

export const metadata: Metadata = { title: "Terms of use" };

export default function TermsPage() {
  return (
    <>
      <MarketingHero eyebrow="Legal" title="Terms of use" intro="The rules for using AgriFlow AI Zambia. Draft for a hackathon prototype, pending legal review." />
      <Section>
        <Prose>
          <h2>1. The service</h2>
          <p>AgriFlow AI provides farm management tools, AI-assisted agricultural information, a marketplace that connects buyers and sellers, input supply listings and delivery coordination. AgriFlow is not a party to sales between users and does not process payments in this version.</p>
          <h2>2. AI and weather information</h2>
          <p>AI responses, crop health assessments and weather-based guidance are advisory only. They may be incomplete or wrong. Always confirm serious crop issues and chemical use with a qualified extension officer, and follow product labels and Zambian regulations. Forecasts are not guarantees.</p>
          <h2>3. Your account</h2>
          <p>Provide accurate information, keep your password private, and use only one account per person or business. You are responsible for activity on your account.</p>
          <h2>4. Listings and orders</h2>
          <p>Sellers must describe produce and products honestly, including quality and quantity. Crop protection products must include safety information and may only be offered where legally permitted. Agreed prices and quantities in a confirmed order bind both parties. Disputes can be raised for administrator review.</p>
          <h2>5. Prohibited use</h2>
          <p>No fraud, misleading listings, harassment, scraping, attempts to access other users&apos; data, or attempts to manipulate the AI into revealing other users&apos; information.</p>
          <h2>6. Moderation</h2>
          <p>Administrators may verify, flag or remove listings and suspend accounts that break these terms. Important administrative actions are recorded in audit logs.</p>
          <h2>7. Liability</h2>
          <p>The platform is provided as is, during a pilot phase. To the extent permitted by law, AgriFlow is not liable for losses arising from reliance on AI or weather information, or from transactions between users.</p>
        </Prose>
      </Section>
    </>
  );
}
