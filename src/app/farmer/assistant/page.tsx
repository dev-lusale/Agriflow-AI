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
import { farmerChatAction } from "@/server/actions/ai";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "AI Assistant" };

const SUGGESTIONS = [
  "When should I plant maize this season?",
  "What are common signs of fall armyworm?",
  "What causes yellowing maize leaves?",
  "How much profit did my farm make?",
  "How should I store harvested maize?",
  "What does my weather forecast mean for this week?",
];

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ c?: string; q?: string }> }) {
  const sp = await searchParams;
  const user = await requirePageRole("FARMER");
  const actor = { id: user.id, role: user.role };
  const [conversations, farms] = await Promise.all([listConversations(actor, "FARMER_ASSISTANT"), prisma.farm.findMany({ where: { ownerId: user.id }, select: { id: true, name: true } })]);
  let initial: ChatMsg[] = [];
  let activeId: string | undefined;
  if (sp.c) {
    try {
      const conv = await getConversationMessages(actor, sp.c);
      activeId = conv.id;
      initial = conv.messages.map((m) => ({ id: m.id, role: m.role, content: m.content, meta: (m.meta as ChatMsg["meta"]) ?? null, model: m.model }));
    } catch {
      activeId = undefined;
    }
  }
  return (
    <>
      <PageHeader
        title="AgriFlow AI Assistant"
        description="Ask about crops, pests, weather, storage or your farm's money. Grok answers using your own records."
        actions={
          <Button asChild variant="outline">
            <Link href="/farmer/assistant">
              <MessageSquarePlus /> New conversation
            </Link>
          </Button>
        }
      />
      {!isAIConfigured() && (
        <Alert tone="amber" className="mb-4" title="Grok is not configured on this server">
          Set XAI_API_KEY to enable live AI answers. Until then, the assistant answers from AgriFlow&apos;s built-in guidance library and your computed farm figures, and labels those answers clearly.
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <aside className="hidden lg:block">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-500">Conversations</p>
          <nav className="space-y-1">
            {conversations.length === 0 && <p className="text-sm text-navy-500">No conversations yet.</p>}
            {conversations.map((c) => (
              <Link key={c.id} href={`/farmer/assistant?c=${c.id}`} className={cn("block rounded-lg px-3 py-2 text-sm hover:bg-white", c.id === activeId ? "bg-white font-medium text-forest-800 shadow-sm ring-1 ring-border" : "text-navy-700")}>
                <span className="line-clamp-1">{c.title}</span>
                <span className="text-xs text-navy-400">{relativeTime(c.updatedAt)}</span>
              </Link>
            ))}
          </nav>
          <div className="mt-6 rounded-xl border border-border bg-white p-3 text-xs text-navy-600">
            <p className="flex items-center gap-1.5 font-semibold text-navy-800">
              <ShieldCheck className="size-4 text-forest-600" /> How your data is used
            </p>
            <p className="mt-1">Only your own farms, crops, activities, cached weather and computed finance totals are shared with Grok, from our server. The AI cannot change your records.</p>
          </div>
        </aside>
        <Chat
          key={activeId ?? "new"}
          conversationId={activeId}
          initialMessages={initial}
          send={farmerChatAction}
          suggestions={SUGGESTIONS}
          initialQuestion={sp.q}
          placeholder="Ask about your crops, pests, weather or profit…"
          basePath="/farmer/assistant"
          assistantName="AgriFlow AI Assistant"
          allowTasks
          farms={farms}
        />
      </div>
    </>
  );
}
