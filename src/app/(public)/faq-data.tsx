import { ChevronDown } from "lucide-react";

export type Faq = { q: string; a: string };

export const HOME_FAQ: Faq[] = [
  { q: "Is AgriFlow AI free for farmers?", a: "Yes. Creating an account, managing farms and listing produce are free in this version. Future commercial plans would be announced clearly in advance." },
  { q: "Does it work without internet?", a: "Partly. The app installs on your phone, and activities, notes and tasks can be recorded offline. They are saved on your device and sync automatically when you reconnect. Orders and payments always need a connection, so nothing is shown as complete when it is not." },
  { q: "Where does the AI advice come from?", a: "The assistant uses Grok by xAI. It receives your own farm records, which AgriFlow computes from the database, and it is instructed to say when it is uncertain. AI advice is guidance only. Confirm serious issues with your camp extension officer." },
  { q: "Are the market prices real?", a: "Each price is labelled: verified observations entered by administrators, historical records, user-submitted offers, or demo data. We never show invented live prices." },
  { q: "Who can see my farm data?", a: "Only you and authorised AgriFlow administrators. Buyers only see what you publish in a listing. The AI only receives your own records when you ask a question." },
];

export const FULL_FAQ: { group: string; items: Faq[] }[] = [
  { group: "General", items: HOME_FAQ },
  {
    group: "Farmers",
    items: [
      { q: "How do I add a farm?", a: "After registering, finish onboarding, then open Farms → Add farm. You can add several farms and divide each one into fields." },
      { q: "Do I need GPS coordinates?", a: "No. GPS is optional. If you add it, weather is fetched for your exact farm. Otherwise we use the approximate location of your district town and say so on screen." },
      { q: "How is profit calculated?", a: "Net profit is all recorded income minus all recorded expenses. Gross profit is produce sales minus direct crop inputs (seed, fertilizer, chemicals, irrigation). Figures use exact decimal arithmetic in Kwacha." },
      { q: "Can the AI change my records?", a: "No. The AI can only suggest tasks. You decide whether to add them, and every change goes through the same validated forms you use yourself." },
    ],
  },
  {
    group: "Buyers & marketplace",
    items: [
      { q: "How does ordering work?", a: "Send a purchase request with a quantity (and optionally your own price). The farmer can accept, reject or counteroffer. Once a price is agreed you confirm the purchase, which reserves the stock." },
      { q: "How do I pay?", a: "This version does not process payments. Buyers and sellers settle payment directly, for example by mobile money or bank transfer. Integrated payments are on the roadmap." },
      { q: "What if there is a problem with my order?", a: "Buyers can raise a dispute after delivery. An administrator reviews disputed orders." },
    ],
  },
  {
    group: "Suppliers & transporters",
    items: [
      { q: "Can I sell crop protection chemicals?", a: "Suppliers must provide safety and handling information and may declare a regulatory registration number. AgriFlow marks products as 'Unverified' until an administrator checks the registration." },
      { q: "How do transporters receive jobs?", a: "Delivery requests are shown to transporters who serve the pickup province, or sent directly to a chosen transporter. The first transporter to accept gets the job." },
    ],
  },
];

export function FaqList({ items }: { items: Faq[] }) {
  return (
    <div className="divide-y divide-border overflow-hidden glass rounded-[1.75rem]">
      {items.map((f) => (
        <details key={f.q} className="group px-5 py-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-navy-900">
            {f.q}
            <ChevronDown className="size-4 shrink-0 text-navy-400 transition-transform group-open:rotate-180" />
          </summary>
          <p className="mt-2 text-sm leading-relaxed text-navy-600">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
