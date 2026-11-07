import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquarePlus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import { PageHeader } from "@/components/layout/page";
import { Chat, type ChatMsg } from "@/components/ai/chat";
import { requirePageRole } from "@/lib/auth/session";
import { isAIConfigured } from "@/lib/env";
import { cn, relativeTime } from "@/lib/utils";
import { getConversationMessages, listConversations } from "@/server/ai/service";
import { adminChatAction } from "@/server/actions/ai";

export const metadata: Metadata = { title: "AI business intelligence" };

const SUGGESTIONS = [
  "How many farmers are registered, and which province has the highest farmer activity?",
  "Which crops are most commonly registered?",
  "How many orders are pending, and what is the total value of completed sales?",
  "Which suppliers have low inventory?",
  "What are the most common crop health concerns?",
  "Summarise agricultural marketplace activity this month.",
];

export default async function AdminAIPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const sp = await searchParams;
  const user = await requirePageRole("ADMIN", "SUPER_ADMIN");
  const actor = { id: user.id, role: user.role };
  const conversations = await listConversations(actor, "ADMIN_INTELLIGENCE");
  let initial: ChatMsg[] = [];
  let activeId: string | undefined;
  if (sp.c) {
    try {
      const conv = await getConversationMessages(actor, sp.c);
      activeId = conv.id;
      initial = conv.messages.map((m) => ({ id: m.id, role: m.role, content: m.content, meta: (m.meta as ChatMsg["meta"]) ?? null }));
    } catch {
      activeId = undefined;
    }
  }
  return (
    <>
      <PageHeader
        title="AI business intelligence"
        description="Ask Grok about platform performance. The backend computes every statistic; Grok only explains it."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/admin/reports">Generate report</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/ai">
                <MessageSquarePlus /> New
              </Link>
            </Button>
          </>
        }
      />
      {!isAIConfigured() && (
        <Alert tone="amber" className="mb-4" title="Grok is not configured">
          Without XAI_API_KEY, answers show the computed statistics without AI commentary.
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <aside className="hidden lg:block">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-500">History</p>
          <nav className="space-y-1">
            {conversations.map((c) => (
              <Link key={c.id} href={`/admin/ai?c=${c.id}`} className={cn("block rounded-lg px-3 py-2 text-sm hover:bg-white", c.id === activeId ? "bg-white font-medium text-forest-800 shadow-sm ring-1 ring-border" : "text-navy-700")}>
                <span className="line-clamp-1">{c.title}</span>
                <span className="text-xs text-navy-400">{relativeTime(c.updatedAt)}</span>
              </Link>
            ))}
          </nav>
          <div className="mt-6 rounded-xl border border-border bg-white p-3 text-xs text-navy-600">
            <p className="flex items-center gap-1.5 font-semibold text-navy-800">
              <ShieldCheck className="size-4 text-forest-600" /> Data boundaries
            </p>
            <p className="mt-1">Grok receives aggregated, non-personal statistics only, such as counts, totals by crop and province, and order status. No names, contacts or individual records are sent.</p>
          </div>
        </aside>
        <Chat key={activeId ?? "new"} conversationId={activeId} initialMessages={initial} send={adminChatAction} suggestions={SUGGESTIONS} placeholder="Ask about farmers, crops, orders, sales, inventory…" basePath="/admin/ai" assistantName="AgriFlow Business Intelligence" />
      </div>
    </>
  );
}
