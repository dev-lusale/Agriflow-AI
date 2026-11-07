"use client";

import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export type PdfSection = { title: string; head: string[]; rows: (string | number)[][] };

/** Client-side PDF export (jsPDF + autotable). Data comes pre-computed from the server. */
export function PdfButton({ filename, title, subtitle, summary, sections, narrative, label = "Download PDF" }: { filename: string; title: string; subtitle?: string; summary?: [string, string][]; sections: PdfSection[]; narrative?: string; label?: string }) {
  return (
    <Button
      variant="outline"
      onClick={async () => {
        const { jsPDF } = await import("jspdf");
        const autoTable = (await import("jspdf-autotable")).default;
        const doc = new jsPDF({ unit: "pt", format: "a4" });
        const W = doc.internal.pageSize.getWidth();
        doc.setFillColor(20, 83, 45);
        doc.rect(0, 0, W, 64, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.text("AgriFlow AI Zambia", 40, 30);
        doc.setFontSize(10);
        doc.text("Grow Smarter. Trade Better. Harvest More.", 40, 48);
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(15);
        doc.text(title, 40, 96);
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(`${subtitle ? subtitle + " · " : ""}Generated ${new Date().toLocaleString("en-ZM")}`, 40, 112);
        let y = 132;
        if (summary?.length) {
          autoTable(doc, { startY: y, body: summary, theme: "plain", styles: { fontSize: 10 }, columnStyles: { 0: { fontStyle: "bold", cellWidth: 180 } } });
          y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
        }
        if (narrative) {
          doc.setFontSize(10);
          doc.setTextColor(30, 41, 59);
          const lines = doc.splitTextToSize(narrative.replace(/[#*>`]/g, "").replace(/\n{3,}/g, "\n\n"), W - 80);
          for (const line of lines) {
            if (y > doc.internal.pageSize.getHeight() - 50) {
              doc.addPage();
              y = 50;
            }
            doc.text(line, 40, y);
            y += 13;
          }
          y += 10;
        }
        for (const s of sections) {
          if (!s.rows.length) continue;
          doc.setFontSize(11);
          doc.setTextColor(15, 23, 42);
          if (y > doc.internal.pageSize.getHeight() - 80) {
            doc.addPage();
            y = 50;
          }
          doc.text(s.title, 40, y);
          autoTable(doc, { startY: y + 6, head: [s.head], body: s.rows.map((r) => r.map(String)), headStyles: { fillColor: [20, 83, 45] }, styles: { fontSize: 9 } });
          y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 22;
        }
        const pages = doc.getNumberOfPages();
        for (let i = 1; i <= pages; i++) {
          doc.setPage(i);
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(`Page ${i} of ${pages} · Figures computed by AgriFlow from recorded data. Amounts in ZMW.`, 40, doc.internal.pageSize.getHeight() - 24);
        }
        doc.save(`${filename}.pdf`);
      }}
    >
      <FileDown /> {label}
    </Button>
  );
}
