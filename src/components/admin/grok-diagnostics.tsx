"use client";

import { useState } from "react";
import { Activity, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Probe = { ok: boolean; model: string; latencyMs: number | null; reason?: string; httpStatus?: number; message?: string; sample?: string } | { skipped: true };
type Report = {
  checkedAt: string;
  keyConfigured: boolean;
  textModel: string;
  visionModel: string;
  text: Probe;
  vision: Probe;
  last24h: { calls: number; ok: number; fallback: number; errors: number; avgLatencyMs: number | null; lastError: string | null };
  verdict: "working" | "not_configured" | "failing" | "partial";
  advice: string[];
};

const VERDICT: Record<Report["verdict"], { label: string; cls: string }> = {
  working: { label: "Grok is working", cls: "bg-forest-50 text-forest-800 ring-forest-200" },
  partial: { label: "Text works, image analysis failed", cls: "bg-amber-50 text-amber-900 ring-amber-200" },
  failing: { label: "Grok calls are failing", cls: "bg-red-50 text-red-800 ring-red-200" },
  not_configured: { label: "Grok is not configured", cls: "bg-amber-50 text-amber-900 ring-amber-200" },
};

function ProbeRow({ name, p }: { name: string; p: Probe }) {
  if ("skipped" in p) return <li className="text-navy-500">{name}: not run</li>;
  return (
    <li className="flex items-start gap-2">
      {p.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-forest-600" aria-hidden /> : <XCircle className="mt-0.5 size-4 shrink-0 text-red-600" aria-hidden />}
      <span>
        <span className="font-medium">{name}</span> · {p.model}
        {p.ok ? ` · ${p.latencyMs} ms` : ` · ${p.reason}${p.httpStatus ? ` ${p.httpStatus}` : ""}`}
        {p.ok && p.sample ? <span className="block text-navy-500">Reply: “{p.sample}”</span> : null}
        {!p.ok && p.message ? <span className="block text-navy-500">{p.message}</span> : null}
      </span>
    </li>
  );
}

/** Admin-only live test of the server's Grok configuration. The key never reaches the browser. */
export function GrokDiagnostics() {
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/diagnostics?vision=1", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setReport(body as Report);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The test could not run.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-border bg-white p-3 text-xs text-navy-700" aria-labelledby="grok-diag">
      <p id="grok-diag" className="flex items-center gap-1.5 font-semibold text-navy-800">
        <Activity className="size-4 text-forest-600" aria-hidden /> Grok connection
      </p>
      <p className="mt-1">Runs a small live text and image call to xAI. Uses a few tokens.</p>
      <Button type="button" size="sm" variant="outline" className="mt-2 w-full" onClick={run} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {busy ? "Testing…" : "Test Grok connection"}
      </Button>
      <div aria-live="polite">
        {error ? <p className="mt-2 text-red-700">{error}</p> : null}
        {report ? (
          <div className="mt-3 space-y-2">
            <p className={`rounded-md px-2 py-1 font-semibold ring-1 ${VERDICT[report.verdict].cls}`}>{VERDICT[report.verdict].label}</p>
            <ul className="space-y-1.5">
              <ProbeRow name="Text" p={report.text} />
              <ProbeRow name="Image" p={report.vision} />
            </ul>
            {report.advice.length ? (
              <ul className="list-disc space-y-1 pl-4 text-navy-800">
                {report.advice.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            ) : null}
            <p className="text-navy-500">
              Last 24 h: {report.last24h.calls} calls · {report.last24h.ok} ok · {report.last24h.fallback} fallback · {report.last24h.errors} errors
              {report.last24h.avgLatencyMs ? ` · avg ${report.last24h.avgLatencyMs} ms` : ""}
            </p>
            <p className="text-navy-400">Checked {new Date(report.checkedAt).toLocaleString()}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
