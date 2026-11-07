import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { PageHeader } from "@/components/layout/page";
import { FormDialog } from "@/components/forms/form-dialog";
import { TaskForm } from "@/components/farm/forms";
import { TaskCheck } from "@/components/farm/task-check";
import { requirePageRole } from "@/lib/auth/session";
import { cn, formatDate } from "@/lib/utils";
import { calendarEvents, type CalendarEvent } from "@/server/farms/service";
import { farmOptions } from "@/server/farms/options";

export const metadata: Metadata = { title: "Farm calendar" };

const KIND_STYLE: Record<CalendarEvent["kind"], string> = {
  TASK: "bg-sky-50 text-sky-800 ring-sky-200",
  PLANTING: "bg-forest-50 text-forest-800 ring-forest-200",
  HARVEST: "bg-harvest-50 text-harvest-800 ring-harvest-200",
  ACTIVITY: "bg-navy-100 text-navy-700 ring-navy-200",
};
const KIND_LABEL: Record<CalendarEvent["kind"], string> = { TASK: "Task", PLANTING: "Planting", HARVEST: "Expected harvest", ACTIVITY: "Recorded activity" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const sp = await searchParams;
  const user = await requirePageRole("FARMER");
  const now = new Date();
  const [y, m] = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month!.split("-").map(Number) : [now.getUTCFullYear(), now.getUTCMonth() + 1];
  const first = new Date(Date.UTC(y!, m! - 1, 1));
  const last = new Date(Date.UTC(y!, m!, 0));
  const gridStart = new Date(first);
  gridStart.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7)); // Monday start
  const gridEnd = new Date(last);
  gridEnd.setUTCDate(last.getUTCDate() + (6 - ((last.getUTCDay() + 6) % 7)));
  const [events, opts] = await Promise.all([calendarEvents({ id: user.id, role: user.role }, gridStart, gridEnd), farmOptions(user.id)]);
  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of events) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
  const days: Date[] = [];
  for (let d = new Date(gridStart); d <= gridEnd; d.setUTCDate(d.getUTCDate() + 1)) days.push(new Date(d));
  const prev = new Date(Date.UTC(y!, m! - 2, 1)).toISOString().slice(0, 7);
  const next = new Date(Date.UTC(y!, m!, 1)).toISOString().slice(0, 7);
  const today = now.toISOString().slice(0, 10);
  const monthEvents = events.filter((e) => e.date >= first.toISOString().slice(0, 10) && e.date <= last.toISOString().slice(0, 10));

  return (
    <>
      <PageHeader
        title="Farm calendar"
        description="Planting dates, expected harvests, recorded activities and your tasks in one view."
        actions={
          <FormDialog trigger={<><Plus /> Add task</>} title="Add a task or reminder">
            <TaskForm farms={opts.map((f) => ({ id: f.id, name: f.name }))} />
          </FormDialog>
        }
      />
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{first.toLocaleDateString("en-ZM", { month: "long", year: "numeric", timeZone: "UTC" })}</CardTitle>
          <div className="flex gap-1">
            <Button asChild size="icon-sm" variant="outline" aria-label="Previous month">
              <Link href={`?month=${prev}`}>
                <ChevronLeft />
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="?">Today</Link>
            </Button>
            <Button asChild size="icon-sm" variant="outline" aria-label="Next month">
              <Link href={`?month=${next}`}>
                <ChevronRight />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            {(Object.keys(KIND_LABEL) as CalendarEvent["kind"][]).map((k) => (
              <span key={k} className={cn("rounded-full px-2 py-0.5 ring-1", KIND_STYLE[k])}>
                {KIND_LABEL[k]}
              </span>
            ))}
          </div>
          {/* Month grid (tablet/desktop) */}
          <div className="hidden overflow-hidden rounded-xl border border-border md:block">
            <div className="grid grid-cols-7 border-b border-border bg-navy-50 text-center text-xs font-semibold text-navy-500">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} className="py-2">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((d) => {
                const key = d.toISOString().slice(0, 10);
                const inMonth = d.getUTCMonth() === m! - 1;
                const evs = byDay.get(key) ?? [];
                return (
                  <div key={key} className={cn("min-h-28 border-b border-r border-border p-1.5", !inMonth && "bg-navy-50/50")}>
                    <p className={cn("mb-1 flex size-6 items-center justify-center rounded-full text-xs", key === today ? "bg-forest-700 font-bold text-white" : inMonth ? "text-navy-700" : "text-navy-300")}>{d.getUTCDate()}</p>
                    <div className="space-y-1">
                      {evs.slice(0, 3).map((e) => (
                        <p key={e.id} title={`${e.title}${e.farm ? ` · ${e.farm}` : ""}`} className={cn("truncate rounded px-1.5 py-0.5 text-[11px] ring-1", KIND_STYLE[e.kind], e.status === "DONE" && "line-through opacity-60")}>
                          {e.title}
                        </p>
                      ))}
                      {evs.length > 3 && <p className="text-[11px] text-navy-500">+{evs.length - 3} more</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Agenda (all sizes) */}
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-semibold">This month</h3>
            {monthEvents.length === 0 ? (
              <p className="text-sm text-navy-500">Nothing scheduled this month.</p>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border">
                {monthEvents.map((e) => (
                  <li key={e.id} className="flex items-start gap-3 px-3 py-2.5">
                    {e.kind === "TASK" && e.taskId ? <TaskCheck id={e.taskId} done={e.status === "DONE"} title={e.title} /> : <span className="mt-1.5 size-2 shrink-0 rounded-full bg-forest-500" />}
                    <div className="min-w-0 flex-1 text-sm">
                      <p className={cn("font-medium", e.status === "DONE" && "line-through text-navy-400")}>{e.title}</p>
                      <p className="text-xs text-navy-500">
                        {formatDate(e.date + "T12:00:00Z", { weekday: "short", day: "numeric", month: "short" })} · {KIND_LABEL[e.kind]}
                        {e.farm ? ` · ${e.farm}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
