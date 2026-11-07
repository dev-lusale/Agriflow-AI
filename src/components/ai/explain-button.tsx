"use client";

import * as React from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import type { ActionResult } from "@/lib/errors";
import { Markdown } from "./markdown";

/** Generic "Ask Grok to explain" button that renders the returned Markdown inline. */
export function ExplainButton({ run, label = "Ask Grok to explain" }: { run: () => Promise<ActionResult<{ mode: "grok" | "fallback"; text: string }>>; label?: string }) {
  const [pending, start] = React.useTransition();
  const [out, setOut] = React.useState<{ mode: string; text: string } | null>(null);
  return (
    <div className="space-y-3">
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await run();
            if (res.ok && res.data) setOut(res.data);
            else if (!res.ok) toast.error(res.error);
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <Sparkles />} {label}
      </Button>
      {out && (
        <div className="rounded-xl border border-border bg-navy-50/60 p-4">
          <Badge tone={out.mode === "grok" ? "green" : "amber"}>{out.mode === "grok" ? "Grok explanation" : "AI unavailable"}</Badge>
          <div className="mt-2">
            <Markdown text={out.text} />
          </div>
        </div>
      )}
    </div>
  );
}
