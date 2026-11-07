"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/** Validated categorical order (dataviz validator: all checks pass on light surface). Assign in order, never cycled. */
export const SERIES = ["#15803d", "#2563eb", "#d97706", "#7c3aed", "#0891b2", "#be185d"] as const;

const AXIS = { stroke: "#94a3b8", fontSize: 12, tickLine: false, axisLine: false } as const;
const GRID = <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />;

const fmtCompact = (v: number) => new Intl.NumberFormat("en-ZM", { notation: "compact", maximumFractionDigits: 1 }).format(v);

type SeriesDef = { key: string; label: string };

function TooltipBox({ active, payload, label, money }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string; money?: boolean }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-white px-3 py-2 text-xs shadow-[var(--shadow-lift)]">
      <p className="mb-1 font-semibold text-navy-900">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-navy-600">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-semibold text-navy-900">{money ? `K ${Number(p.value).toLocaleString("en-ZM", { maximumFractionDigits: 2 })}` : Number(p.value).toLocaleString("en-ZM")}</span>
        </p>
      ))}
    </div>
  );
}

/** Grouped vertical bars (e.g. monthly income vs expenses). */
export function GroupedBars({ data, xKey, series, money, height = 260 }: { data: Record<string, unknown>[]; xKey: string; series: SeriesDef[]; money?: boolean; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} barGap={2} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        {GRID}
        <XAxis dataKey={xKey} {...AXIS} />
        <YAxis {...AXIS} width={48} tickFormatter={fmtCompact} />
        <Tooltip cursor={{ fill: "#f1f5f9" }} content={<TooltipBox money={money} />} />
        {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "#475569" }} />}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={SERIES[i]} radius={[4, 4, 0, 0]} maxBarSize={28} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Horizontal bars for ranked categories (single series → no legend; title names it). */
export function RankedBars({ data, labelKey, valueKey, money, height, color = SERIES[0] }: { data: Record<string, unknown>[]; labelKey: string; valueKey: string; money?: boolean; height?: number; color?: string }) {
  const h = height ?? Math.max(160, data.length * 36 + 24);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" {...AXIS} tickFormatter={fmtCompact} />
        <YAxis type="category" dataKey={labelKey} {...AXIS} width={112} />
        <Tooltip cursor={{ fill: "#f1f5f9" }} content={<TooltipBox money={money} />} />
        <Bar dataKey={valueKey} name={money ? "Amount" : "Count"} fill={color} radius={[0, 4, 4, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Stacked bars (e.g. registrations per month by role). */
export function StackedBars({ data, xKey, series, height = 260 }: { data: Record<string, unknown>[]; xKey: string; series: SeriesDef[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        {GRID}
        <XAxis dataKey={xKey} {...AXIS} />
        <YAxis {...AXIS} width={36} allowDecimals={false} />
        <Tooltip cursor={{ fill: "#f1f5f9" }} content={<TooltipBox />} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "#475569" }} />
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} stackId="a" fill={SERIES[i]} stroke="#ffffff" strokeWidth={2} radius={i === series.length - 1 ? [4, 4, 0, 0] : 0} maxBarSize={32} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Lines over time (e.g. price history per province). */
export function TrendLines({ data, xKey, series, money, height = 280 }: { data: Record<string, unknown>[]; xKey: string; series: SeriesDef[]; money?: boolean; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        {GRID}
        <XAxis dataKey={xKey} {...AXIS} />
        <YAxis {...AXIS} width={48} tickFormatter={fmtCompact} />
        <Tooltip cursor={{ stroke: "#94a3b8", strokeDasharray: "3 3" }} content={<TooltipBox money={money} />} />
        {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "#475569" }} />}
        {series.map((s, i) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={SERIES[i % SERIES.length]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 5 }} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
