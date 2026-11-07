import { Bell, Bot, ChartLine, CloudSun, HeartPulse, Home, Leaf, Plus, Search, Settings, Sprout, Tractor, Truck, Wallet } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

/** Illustrative product screens (static HTML, labelled "Product preview" by the caller). */
function Phone({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative w-[15.5rem] shrink-0 rounded-[2.6rem] bg-white/50 p-[7px] shadow-[0_40px_80px_-30px_rgb(13_17_22/0.35)] ring-1 ring-white/80 backdrop-blur", className)}>
      <div className="relative h-[31rem] overflow-hidden rounded-[2.2rem] bg-[#eaf2f5]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(18rem_12rem_at_30%_0%,white,transparent_70%),radial-gradient(16rem_10rem_at_100%_30%,#d6eaf3,transparent_70%)]" />
        <div className="relative flex items-center justify-between px-6 pt-3 text-[10px] font-semibold text-navy-900">
          <span>10:41</span>
          <span className="h-5 w-20 rounded-full bg-ink" />
          <span>●●● 5G</span>
        </div>
        <div className="relative h-[calc(100%-1.75rem)]">{children}</div>
      </div>
    </div>
  );
}

function TabBar({ active }: { active: number }) {
  const items = [
    [Home, "Home"],
    [ChartLine, "Statistic"],
    [Sprout, "Crops"],
    [Truck, "Orders"],
    [Settings, "Settings"],
  ] as const;
  return (
    <div className="absolute inset-x-0 bottom-0 grid grid-cols-5 bg-white/90 px-2 pb-3 pt-2 backdrop-blur">
      {items.map(([I, l], i) => (
        <span key={l} className={cn("flex flex-col items-center gap-0.5 text-[8.5px] font-semibold", i === active ? "text-ink" : "text-navy-400")}>
          <I className="size-3.5" />
          {l}
        </span>
      ))}
    </div>
  );
}

export function PhoneOverview() {
  return (
    <Phone>
      <div className="px-4 pt-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[11px] font-bold">
            <LogoMark className="h-4 w-6" /> AgriFlow
          </span>
          <span className="flex gap-1.5">
            <span className="flex size-6 items-center justify-center rounded-full bg-white shadow-sm">
              <Bell className="size-3" />
            </span>
            <span className="size-6 rounded-full bg-gradient-to-br from-forest-400 to-forest-800" />
          </span>
        </div>
        <p className="mt-4 text-[10px] text-navy-500">Your Farm Overview</p>
        <p className="text-[17px] font-semibold leading-tight">Welcome back, Joseph</p>
        <div className="iridescent mt-3 rounded-2xl border border-white/80 p-3 shadow-lg">
          <p className="flex items-center gap-1 text-[9px] font-semibold text-navy-700">
            <Leaf className="size-3 text-forest-600" /> Season 2025/26
          </p>
          <p className="mt-3 text-[9px] text-navy-500">Net profit</p>
          <p className="text-[19px] font-light">K 45,150.00</p>
          <div className="mt-2 flex justify-between text-[8px] text-navy-500">
            <span>
              Farm
              <br />
              <b className="text-navy-800">Mwale Family Farm</b>
            </span>
            <span>
              Area
              <br />
              <b className="text-navy-800">6.5 ha</b>
            </span>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-[9px] font-semibold">
          <span className="rounded-full bg-white px-2.5 py-1 shadow-sm">Sell ↗</span>
          <span className="rounded-full bg-white px-2.5 py-1 shadow-sm">Buy inputs ↙</span>
          <span className="ml-auto flex size-6 items-center justify-center rounded-full bg-ink text-white">
            <Plus className="size-3" />
          </span>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 top-[18.2rem] rounded-t-3xl bg-white px-4 pt-2 shadow-[0_-10px_30px_-20px_rgb(0_0_0/0.3)]">
        <div className="mx-auto h-1 w-8 rounded-full bg-navy-200" />
        <div className="mt-2 flex items-center justify-between text-[11px] font-semibold">
          Activity <Search className="size-3 text-navy-400" />
        </div>
        {[
          ["Maize sale · 150 bags", "Marketplace", "+K51,300", "text-forest-600"],
          ["Urea top-dressing", "Fertilizer", "−K22,800", "text-red-500"],
          ["Weeding, 6 workers", "Labour", "−K3,000", "text-red-500"],
        ].map(([t, c, v, cl]) => (
          <div key={t} className="mt-2 flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-forest-50 text-forest-700">
              <Sprout className="size-3" />
            </span>
            <span className="flex-1">
              <span className="block text-[9.5px] font-semibold">{t}</span>
              <span className="block text-[8px] text-navy-400">{c}</span>
            </span>
            <span className={cn("text-[9.5px] font-semibold", cl)}>{v}</span>
          </div>
        ))}
        <TabBar active={0} />
      </div>
    </Phone>
  );
}

export function PhoneAnalytics() {
  const bars = [30, 42, 36, 55, 68, 50, 46];
  return (
    <Phone>
      <div className="px-4 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-semibold">Analytics</span>
          <span className="size-6 rounded-full bg-gradient-to-br from-forest-400 to-forest-800" />
        </div>
        <div className="mt-4 flex items-center justify-between text-[10px] text-navy-500">
          My income <span className="rounded-full bg-white px-2 py-0.5 text-[8.5px] font-semibold text-navy-700 shadow-sm">This week ▾</span>
        </div>
        <p className="text-[20px] font-light">K 86,400.00</p>
        <p className="text-[8.5px] text-forest-600">▲ 6.9% from last season</p>
        <div className="relative mt-3 flex h-16 items-end gap-1">
          {bars.map((h, i) => (
            <span key={i} className={cn("flex-1 rounded-t", i === 4 ? "bg-ink" : "bg-navy-200")} style={{ height: `${h}%` }} />
          ))}
          <span className="absolute -top-2 left-[56%] rounded-full bg-ink px-1.5 py-0.5 text-[7.5px] font-semibold text-white">K 51,300</span>
        </div>
        <div className="mt-1 flex justify-between text-[7.5px] text-navy-400">
          {["Nov", "Dec", "Jan", "Feb", "May", "Jun", "Jul"].map((m) => (
            <span key={m}>{m}</span>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between text-[10px] text-navy-500">
          My expenses <span className="rounded-full bg-white px-2 py-0.5 text-[8.5px] font-semibold text-navy-700 shadow-sm">This season ▾</span>
        </div>
        <p className="text-[20px] font-light">−K 41,250.00</p>
        <p className="text-[8.5px] text-red-500">▼ 4.9% from last season</p>
        <svg viewBox="0 0 200 60" className="mt-2 h-14 w-full" aria-hidden>
          <path d="M0 40 C 25 10, 45 55, 70 30 S 115 5, 135 35 S 175 50, 200 20" fill="none" stroke="#0d1116" strokeWidth="1.4" />
          <path d="M0 30 C 30 50, 50 15, 80 35 S 120 55, 150 20 S 185 15, 200 40" fill="none" stroke="#97a3ad" strokeWidth="1" />
          <circle cx="150" cy="21" r="3" fill="#0d1116" />
          <line x1="150" y1="21" x2="150" y2="60" stroke="#0d1116" strokeDasharray="2 2" strokeWidth="0.6" />
        </svg>
      </div>
      <div className="absolute inset-x-3 bottom-16 rounded-2xl bg-white/90 p-2.5 shadow-sm">
        {[
          ["Fertilizer", "−K21,600"],
          ["Labour", "−K8,100"],
          ["Seeds", "−K8,925"],
        ].map(([l, v]) => (
          <div key={l} className="flex items-center justify-between py-0.5 text-[9.5px]">
            <span className="flex items-center gap-1.5 font-medium">
              <Wallet className="size-3 text-navy-400" />
              {l}
            </span>
            <span className="font-semibold">{v}</span>
          </div>
        ))}
      </div>
      <TabBar active={1} />
    </Phone>
  );
}

export function PhoneAI() {
  return (
    <Phone>
      <div className="px-4 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-semibold">Crop care</span>
          <span className="rounded-full bg-white px-2.5 py-1 text-[8.5px] font-semibold shadow-sm">New check</span>
        </div>
        <div className="relative mt-6 h-36">
          <div className="absolute inset-x-6 top-0 h-28 rounded-2xl bg-white/50 shadow-sm" />
          <div className="absolute inset-x-3 top-3 h-28 rounded-2xl bg-white/70 shadow-sm" />
          <div className="iridescent absolute inset-x-0 top-6 rounded-2xl border border-white/80 p-3 shadow-lg">
            <p className="flex items-center justify-between text-[9px] font-semibold">
              <span className="flex items-center gap-1">
                <LogoMark className="h-3.5 w-5" /> Grok assessment
              </span>
              <HeartPulse className="size-3.5 text-red-500" />
            </p>
            <p className="mt-4 text-[8.5px] text-navy-500">Maize · Field A</p>
            <p className="text-[12px] font-semibold leading-tight">Likely fall armyworm</p>
            <p className="mt-1 text-[8.5px] text-navy-600">Confidence: medium · scout 20 plants</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          {[
            [Bot, "Ask AI"],
            [CloudSun, "Weather"],
            [Tractor, "Activities"],
          ].map(([I, l]) => (
            <span key={l as string} className="flex flex-col items-center gap-1 text-[8.5px] font-semibold">
              <span className="flex size-9 items-center justify-center rounded-full bg-white shadow-sm">
                <I className="size-3.5" />
              </span>
              {l as string}
            </span>
          ))}
        </div>
        <div className="mt-5 rounded-full bg-ink py-2.5 text-center text-[10px] font-semibold text-white">Ask AgriFlow AI</div>
        <div className="mt-2 rounded-full bg-white py-2.5 text-center text-[10px] font-semibold shadow-sm">Add to calendar</div>
      </div>
      <TabBar active={2} />
    </Phone>
  );
}

export function PhoneTrio() {
  return (
    <div className="relative flex justify-center" aria-label="Product preview">
      <div className="flex items-end gap-5 [&>*:nth-child(2)]:-translate-y-6">
        <PhoneOverview />
        <PhoneAnalytics />
        <PhoneAI />
      </div>
    </div>
  );
}
