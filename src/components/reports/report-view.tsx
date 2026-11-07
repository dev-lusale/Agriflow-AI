import { Badge, Card, CardContent, CardHeader, CardTitle, Table, THead, TBody, TR, TH, TD } from "@/components/ui/primitives";
import { Markdown } from "@/components/ai/markdown";
import { PdfButton, type PdfSection } from "@/components/finance/pdf-button";
import { formatDate, formatDateTime, titleCase } from "@/lib/utils";
import type { AIReport } from "@prisma/client";

type Row = Record<string, unknown>;
const fmt = (v: unknown) => (v === null || v === undefined ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));

/** Turns the computed report data (JSON) into tables. Narrative is rendered separately and labelled. */
function toSections(data: Record<string, unknown>): PdfSection[] {
  const sections: PdfSection[] = [];
  const scalars: [string, string][] = [];
  const walk = (obj: Record<string, unknown>, prefix = "") => {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix} · ${titleCase(k.replace(/([A-Z])/g, " $1"))}` : titleCase(k.replace(/([A-Z])/g, " $1"));
      if (Array.isArray(v)) {
        if (v.length && typeof v[0] === "object" && v[0] !== null) {
          const head = Object.keys(v[0] as Row);
          sections.push({ title: key, head: head.map((h) => titleCase(h.replace(/([A-Z])/g, " $1"))), rows: (v as Row[]).map((r) => head.map((h) => fmt(r[h]))) });
        } else if (v.length) scalars.push([key, v.join(", ")]);
      } else if (v && typeof v === "object") walk(v as Record<string, unknown>, key);
      else scalars.push([key, fmt(v)]);
    }
  };
  walk(data);
  return [{ title: "Key figures", head: ["Measure", "Value"], rows: scalars }, ...sections];
}

export function ReportView({ report }: { report: AIReport }) {
  const sections = toSections(report.data as Record<string, unknown>);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-navy-500">
          <Badge tone={report.status === "OK" ? "green" : "amber"}>{report.status === "OK" ? `Narrative by ${report.model ?? "Grok"}` : "Figures only (AI unavailable)"}</Badge>
          Period {formatDate(report.periodStart)} – {formatDate(report.periodEnd)} · generated {formatDateTime(report.createdAt)}
        </div>
        <PdfButton filename={`agriflow-${report.type.toLowerCase()}-${report.createdAt.toISOString().slice(0, 10)}`} title={report.title} subtitle={`${formatDate(report.periodStart)} – ${formatDate(report.periodEnd)}`} narrative={report.narrative} sections={sections} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
          <p className="text-xs text-navy-500">Written from the computed figures below. Figures are calculated by AgriFlow, not by the AI.</p>
        </CardHeader>
        <CardContent>
          <Markdown text={report.narrative} />
        </CardContent>
      </Card>
      {sections.map((s) =>
        s.rows.length ? (
          <Card key={s.title}>
            <CardHeader>
              <CardTitle>{s.title}</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <THead>
                  <tr>
                    {s.head.map((h) => (
                      <TH key={h}>{h}</TH>
                    ))}
                  </tr>
                </THead>
                <TBody>
                  {s.rows.map((r, i) => (
                    <TR key={i}>
                      {r.map((c, j) => (
                        <TD key={j} className="text-sm">
                          {String(c)}
                        </TD>
                      ))}
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        ) : null,
      )}
    </div>
  );
}
