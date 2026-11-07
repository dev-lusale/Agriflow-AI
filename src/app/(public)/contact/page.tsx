import type { Metadata } from "next";
import { Mail, MessageSquare, Phone } from "lucide-react";
import { MarketingHero, Section } from "@/components/layout/marketing";
import { Card } from "@/components/ui/primitives";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <>
      <MarketingHero eyebrow="Contact" title="Talk to the AgriFlow team" intro="Questions about the platform, partnerships with cooperatives, agro-dealers or extension programmes? Send us a message." />
      <Section>
        <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
          <div className="space-y-4">
            {[
              { i: MessageSquare, t: "In-app support", d: "Signed-in users can message the team from their dashboard. Messages go to platform administrators." },
              { i: Mail, t: "Email", d: "Messages sent with this form are delivered to the administrators' inbox in AgriFlow." },
              { i: Phone, t: "Phone & WhatsApp", d: "Support lines will be published at launch. This hackathon build does not send SMS or WhatsApp messages." },
            ].map((c) => (
              <div key={c.t} className="flex gap-4 rounded-2xl border border-border p-5">
                <c.i className="size-5 shrink-0 text-forest-600" />
                <div>
                  <p className="font-semibold">{c.t}</p>
                  <p className="mt-1 text-sm text-navy-600">{c.d}</p>
                </div>
              </div>
            ))}
          </div>
          <Card className="p-6">
            <ContactForm />
          </Card>
        </div>
      </Section>
    </>
  );
}
