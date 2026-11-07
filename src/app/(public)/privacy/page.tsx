import type { Metadata } from "next";
import { MarketingHero, Prose, Section } from "@/components/layout/marketing";

export const metadata: Metadata = { title: "Privacy notice" };

export default function PrivacyPage() {
  return (
    <>
      <MarketingHero eyebrow="Legal" title="Privacy notice" intro="How AgriFlow AI Zambia collects, uses and protects personal data. Draft for a hackathon prototype, pending legal review." />
      <Section>
        <Prose>
          <p>
            <strong>Status:</strong> This notice describes how the platform is designed to handle personal data. It has not yet been reviewed by a lawyer or the Office of the Data Protection Commissioner. AgriFlow AI does not claim certification or full compliance with the Data Protection Act No. 3 of 2021 of Zambia, or with consumer protection and electronic transactions law. These would be confirmed before a commercial launch.
          </p>
          <h2>What we collect</h2>
          <ul>
            <li>Account data: name, email, optional phone number, province, district and account type.</li>
            <li>Farm data you enter: farms, fields, crops, activities, inventory, finances, notes and photos.</li>
            <li>Marketplace data: listings, orders, offers, messages and deliveries.</li>
            <li>Technical data: session cookies (required for sign-in), basic request logs and AI usage records (feature, timestamps, token counts).</li>
          </ul>
          <p>We do not ask for national registration card numbers, bank details or mobile-money PINs.</p>
          <h2>Why we use it</h2>
          <ul>
            <li>To provide the services you choose: farm records, AI advice, marketplace, deliveries and notifications.</li>
            <li>To keep the platform safe: fraud prevention, moderation, rate limiting and audit logs.</li>
            <li>With your consent, recorded when you create an account, for processing as described here.</li>
          </ul>
          <h2>AI processing</h2>
          <p>
            When you use AI features, the minimum necessary records (for example your crops, district, activities and computed financial totals) and your question or photo are sent securely from our server to xAI&apos;s Grok API for processing. Requests are sent with server-side storage disabled. Administrators&apos; AI analysis uses aggregated, non-personal statistics only.
          </p>
          <h2>Who can see your data</h2>
          <ul>
            <li>You, and AgriFlow administrators for support, moderation and safety.</li>
            <li>Other users only see what you publish (listing details, your public name, district) and what you share in orders, messages and deliveries with them.</li>
            <li>Service providers that host the platform (e.g. database, hosting, AI and weather providers), under their terms.</li>
          </ul>
          <h2>Your rights</h2>
          <p>You can ask to access, correct or delete your personal data, or withdraw consent, by contacting us. Some records, such as completed orders, may need to be kept for legal or audit reasons.</p>
          <h2>Security</h2>
          <p>Passwords are hashed. Sessions use secure, HTTP-only cookies. Access is checked on the server for every request. Offline drafts are stored only on your own device and are cleared when you sign out.</p>
        </Prose>
      </Section>
    </>
  );
}
