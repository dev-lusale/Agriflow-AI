import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Bot, CalendarDays, ClipboardList, CloudSun, HeartPulse, ListChecks, Plus, Sprout, Tags, Tractor, Wallet, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, Progress, Badge, Trend } from "@/components/ui/primitives";
import { EmptyState, HeroCard, PageHeader, QuickAction, StatCard } from "@/components/layout/page";
import { GroupedBars } from "@/components/charts/charts";
import { WeatherCard, WeatherCardSkeleton } from "@/components/weather/weather-card";
import { TaskCheck } from "@/components/farm/task-check";
import { requirePageRole } from "@/lib/auth/session";
import { formatZMW } from "@/lib/money";
import { ACTIVITY_LABEL, GROWTH_STAGE_LABEL } from "@/lib/labels";
import { formatDate, formatNumber } from "@/lib/utils";
import { farmerOverview } from "@/server/farms/service";
import { financialSummary } from "@/server/finance/service";

export const metadata: Metadata = { title: "Farmer dashboard" };

const STAGE_PROGRESS: Record<string, number> = { PLANNED: 5, GERMINATION: 15, VEGETATIVE: 40, FLOWERING: 60, GRAIN_FILL: 80, MATURITY: 95, HARVESTED: 100 };

export default async function FarmerDashboard() {
  const user = await requirePageRole("FARMER");
  const actor = { id: user.id, role: user.role };
  const [o, fin] = await Promise.all([farmerOverview(actor), financialSummary(user.id)]);
  const hectares = o.farms.reduce((a, f) => a + Number(f.size) * (f.sizeUnit === "ACRES" ? 0.4047 : 1), 0);
  const firstName = user.profile?.fullName?.split(" ")[0] ?? "Farmer";
  const primary = o.farms[0];

  return (
    <>
      <PageHeader
        eyebrow="Your Farm Overview"
        title={`Muli bwanji, ${firstName}`}
        description={new Date().toLocaleDateString("en-ZM", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Lusaka" })}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/farmer/activities?new=1">
                <ListChecks /> Record activity
              </Link>
            </Button>
            <Button asChild>
              <Link href="/farmer/assistant">
                <Bot /> Ask AgriFlow AI
              </Link>
            </Button>
          </>
        }
      />

      {o.farms.length === 0 ? (
        <EmptyState
          icon={Tractor}
          title="Register your first farm"
          description="Add a farm to start tracking fields, crops, activities, weather and finances."
          action={
            <Button asChild>
              <Link href="/farmer/farms/new">
                <Plus /> Add a farm
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
            <HeroCard
              eyebrow="AgriFlow farm account"
              label="Net profit · recorded actuals"
              value={formatZMW(fin.netProfit)}
              badge={<Badge tone="slate" className="bg-white/70">ZMW</Badge>}
              meta={[
                ["Income", formatZMW(fin.totalIncome)],
                ["Expenses", formatZMW(fin.totalExpenses)],
                ["Area", `${formatNumber(hectares, 1)} ha`],
              ]}
              footer={
                fin.monthly.length >= 2 ? (
                  <Trend
                    value={(() => {
                      const m = fin.monthly.slice(-2).map((x) => Number(x.net));
                      return m[0] === 0 ? 0 : ((m[1]! - m[0]!) / Math.abs(m[0]!)) * 100;
                    })()}
                    suffix=" net vs previous month"
                  />
                ) : undefined
              }
            />
            <div className="grid grid-cols-2 gap-3 stagger">
              <StatCard label="Farms" value={o.farms.length} hint={`${formatNumber(hectares, 1)} ha registered`} icon={Tractor} href="/farmer/farms" />
              <StatCard label="Active crops" value={o.activeCrops.length} hint="Planned or growing" icon={Sprout} href="/farmer/crops" />
              <StatCard label="Open orders" value={o.openOrders} hint={`${o.listings} active listings`} icon={ClipboardList} tone="sky" href="/farmer/orders" />
              <StatCard label="Tasks due" value={o.tasks.length} hint="Next 14 days" icon={CalendarDays} tone="amber" href="/farmer/calendar" />
            </div>
          </div>

          <div className="glass flex justify-between gap-2 overflow-x-auto rounded-[1.75rem] px-4 py-4 shadow-[var(--shadow-card)] sm:justify-around sm:px-8">
            <QuickAction href="/farmer/activities?new=1" icon={ListChecks} label="Record" />
            <QuickAction href="/farmer/assistant" icon={Bot} label="Ask AI" />
            <QuickAction href="/farmer/crop-health" icon={HeartPulse} label="Crop health" />
            <QuickAction href="/farmer/weather" icon={CloudSun} label="Weather" />
            <QuickAction href="/farmer/listings?new=1" icon={Tags} label="Sell" />
            <QuickAction href="/farmer/finances" icon={Wallet} label="Money" />
          </div>

          {o.lowStock > 0 && (
            <Link href="/farmer/inventory" className="flex items-center gap-3 rounded-2xl bg-harvest-50/90 px-4 py-3 text-sm font-medium text-harvest-800 ring-1 ring-harvest-200/60 backdrop-blur transition hover:bg-harvest-100">
              <Warehouse className="size-4" /> {o.lowStock} inventory item(s) are at or below their minimum stock level.
            </Link>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle>Active crops</CardTitle>
                  <Button asChild size="sm" variant="ghost">
                    <Link href="/farmer/crops?new=1">
                      <Plus /> Add crop
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  {o.activeCrops.length === 0 ? (
                    <p className="text-sm text-navy-500">No active crops. Add a crop record to track growth stages and harvest dates.</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {o.activeCrops.slice(0, 6).map((c) => (
                        <li key={c.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">
                              {c.crop.name}
                              {c.variety && <span className="text-navy-500"> · {c.variety}</span>}
                            </p>
                            <p className="text-xs text-navy-500">
                              {c.farm.name}
                              {c.field ? ` · ${c.field.name}` : ""} · planted {formatDate(c.plantingDate)}
                            </p>
                          </div>
                          <div className="w-full sm:w-48">
                            <div className="mb-1 flex justify-between text-xs">
                              <span className="text-navy-600">{GROWTH_STAGE_LABEL[c.growthStage]}</span>
                              <span className="text-navy-400">{c.expectedHarvestDate ? `harvest ${formatDate(c.expectedHarvestDate, { day: "numeric", month: "short" })}` : ""}</span>
                            </div>
                            <Progress value={STAGE_PROGRESS[c.growthStage] ?? 0} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <div>
                    <CardTitle>Income vs expenses</CardTitle>
                    <p className="text-xs text-navy-500">Recorded actuals by month (ZMW)</p>
                  </div>
                  <Link href="/farmer/finances" className="text-xs font-semibold text-forest-700 hover:underline">
                    Finances
                  </Link>
                </CardHeader>
                <CardContent>
                  {fin.monthly.length ? (
                    <GroupedBars
                      data={fin.monthly.slice(-6).map((m) => ({ month: m.month, Income: Number(m.income), Expenses: Number(m.expenses) }))}
                      xKey="month"
                      series={[
                        { key: "Income", label: "Income" },
                        { key: "Expenses", label: "Expenses" },
                      ]}
                      money
                      height={220}
                    />
                  ) : (
                    <p className="text-sm text-navy-500">Record income and expenses to see your monthly trend.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle>Recent activities</CardTitle>
                  <Link href="/farmer/activities" className="text-xs font-semibold text-forest-700 hover:underline">
                    View all
                  </Link>
                </CardHeader>
                <CardContent>
                  {o.recentActivities.length ? (
                    <ul className="space-y-3">
                      {o.recentActivities.map((a) => (
                        <li key={a.id} className="flex items-start justify-between gap-3 text-sm">
                          <div>
                            <p className="font-medium">{ACTIVITY_LABEL[a.type]}</p>
                            <p className="text-xs text-navy-500">
                              {a.farm.name}
                              {a.notes ? ` · ${a.notes.slice(0, 70)}` : ""}
                            </p>
                          </div>
                          <div className="shrink-0 text-right text-xs text-navy-500">
                            {formatDate(a.date)}
                            {a.cost && <p className="font-medium text-navy-700">{formatZMW(a.cost)}</p>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-navy-500">No activities recorded yet.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              {primary && (
                <Suspense fallback={<WeatherCardSkeleton />}>
                  <WeatherCard actor={actor} farmId={primary.id} farmName={primary.name} />
                </Suspense>
              )}

              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <CalendarDays className="size-4 text-forest-600" /> Upcoming tasks
                  </CardTitle>
                  <Link href="/farmer/calendar" className="text-xs font-semibold text-forest-700 hover:underline">
                    Calendar
                  </Link>
                </CardHeader>
                <CardContent>
                  {o.tasks.length ? (
                    <ul className="space-y-2">
                      {o.tasks.map((t) => (
                        <li key={t.id} className="flex items-start gap-3 rounded-lg p-1.5 hover:bg-navy-50">
                          <TaskCheck id={t.id} done={false} />
                          <div className="min-w-0 text-sm">
                            <p className="font-medium leading-snug">{t.title}</p>
                            <p className="text-xs text-navy-500">
                              {formatDate(t.dueDate, { day: "numeric", month: "short" })}
                              {t.farm ? ` · ${t.farm.name}` : ""}
                              {t.dueDate < new Date() && <Badge tone="red" className="ml-1.5">Overdue</Badge>}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-navy-500">No tasks due in the next two weeks.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="iridescent-dark overflow-hidden border-0 text-white">
                <div className="p-5">
                  <p className="flex items-center gap-2 font-semibold text-white">
                    <Bot className="size-4 text-forest-300" /> Ask AgriFlow AI
                  </p>
                  <p className="mt-1 text-sm text-forest-100/80">Grok answers using your farm records.</p>
                  <div className="mt-4 flex flex-col gap-2">
                    {["How is my maize doing for its growth stage?", "What is my net profit this season?", "What should I do this week?"].map((q) => (
                      <Link key={q} href={`/farmer/assistant?q=${encodeURIComponent(q)}`} className="rounded-lg bg-white/10 px-3 py-2 text-sm text-forest-50 hover:bg-white/15">
                        {q}
                      </Link>
                    ))}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button asChild size="sm" variant="accent">
                      <Link href="/farmer/crop-health">
                        <HeartPulse /> Crop health
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">
                      <Link href="/farmer/listings?new=1">
                        <Tags /> Sell produce
                      </Link>
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
