"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bot, CalendarPlus, Database, HelpCircle, Info, Loader2, SendHorizonal, TriangleAlert, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Textarea } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { ACTIVITY_LABEL } from "@/lib/labels";
import type { ActionResult } from "@/lib/errors";
import { addSuggestedTaskAction } from "@/server/actions/ai";
import { Markdown } from "./markdown";

export type ChatMsg = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  meta?: {
    mode?: "grok" | "fallback";
    notice?: string | null;
    used_farm_data?: boolean;
    uncertainty_note?: string | null;
    clarifying_question?: string | null;
    suggested_tasks?: { title: string; due_in_days: number; activity_type: string }[];
  } | null;
  model?: string | null;
  createdAt?: string;
};

type Reply = { conversationId: string; messageId: string; mode: "grok" | "fallback"; notice?: string; answer?: { answer: string; clarifying_question: string | null; uncertainty_note: string | null; used_farm_data: boolean; suggested_tasks: { title: string; due_in_days: number; activity_type: string }[] }; content?: string };

/**
 * Chat UI shared by the farmer assistant and admin business intelligence.
 * The server action calls Grok on the server; the browser never sees the API key.
 */
export function Chat({
  conversationId: initialId,
  initialMessages,
  send,
  suggestions,
  initialQuestion,
  placeholder,
  basePath,
  assistantName,
  allowTasks,
  farms,
}: {
  conversationId?: string;
  initialMessages: ChatMsg[];
  send: (input: { conversationId?: string; message: string }) => Promise<ActionResult<Reply>>;
  suggestions: string[];
  initialQuestion?: string;
  placeholder: string;
  basePath: string;
  assistantName: string;
  allowTasks?: boolean;
  farms?: { id: string; name: string }[];
}) {
  const [messages, setMessages] = React.useState<ChatMsg[]>(initialMessages);
  const [conversationId, setConversationId] = React.useState(initialId);
  const [input, setInput] = React.useState(initialQuestion ?? "");
  const [pending, start] = React.useTransition();
  const router = useRouter();
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  const ask = (text: string) => {
    const message = text.trim();
    if (!message || pending) return;
    if (!navigator.onLine) {
      toast.error("You're offline. The AI assistant needs an internet connection.");
      return;
    }
    setInput("");
    setMessages((m) => [...m, { id: `tmp-${Date.now()}`, role: "USER", content: message }]);
    start(async () => {
      const res = await send({ conversationId, message });
      if (!res.ok || !res.data) {
        toast.error(res.ok ? "No response" : res.error);
        setMessages((m) => m.filter((x) => !x.id.startsWith("tmp-")));
        setInput(message);
        return;
      }
      const r = res.data;
      const content = r.answer?.answer ?? r.content ?? "";
      setMessages((m) => [
        ...m,
        {
          id: r.messageId,
          role: "ASSISTANT",
          content,
          meta: { mode: r.mode, notice: r.notice ?? null, ...(r.answer ?? {}) },
        },
      ]);
      if (!conversationId) {
        setConversationId(r.conversationId);
        router.replace(`${basePath}?c=${r.conversationId}`, { scroll: false });
        router.refresh();
      }
    });
  };

  return (
    <div className="flex h-[calc(100dvh-13rem)] min-h-[480px] flex-col overflow-hidden glass rounded-[1.75rem] shadow-[var(--shadow-card)] lg:h-[calc(100dvh-11rem)]">
      <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6" aria-live="polite">
        {messages.length === 0 && (
          <div className="mx-auto max-w-xl py-6 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-ink text-white">
              <Bot className="size-6" />
            </div>
            <p className="mt-4 text-lg font-semibold">{assistantName}</p>
            <p className="mt-1 text-sm text-navy-500">Powered by Grok (xAI). Answers use your own AgriFlow records, and every figure is computed by the AgriFlow backend.</p>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {suggestions.map((s) => (
                <button key={s} onClick={() => ask(s)} className="rounded-xl border border-border px-3 py-2.5 text-left text-sm text-navy-700 transition hover:border-forest-300 hover:bg-forest-50">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} msg={m} allowTasks={allowTasks} farms={farms} />
        ))}
        {pending && (
          <div className="flex items-center gap-3 text-sm text-navy-500">
            <span className="flex size-8 items-center justify-center rounded-full bg-ink text-white">
              <Loader2 className="size-4 animate-spin" />
            </span>
            Thinking with your farm data…
          </div>
        )}
        <div ref={endRef} />
      </div>
      <form
        className="border-t border-border bg-navy-50/60 p-3 sm:p-4"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(input);
              }
            }}
            placeholder={placeholder}
            rows={1}
            maxLength={2000}
            className="max-h-40 min-h-[44px] flex-1 resize-none bg-white"
            aria-label="Your question"
          />
          <Button type="submit" size="icon" disabled={pending || !input.trim()} aria-label="Send">
            {pending ? <Loader2 className="animate-spin" /> : <SendHorizonal />}
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-navy-500">AI guidance can be wrong. Confirm serious crop problems and any chemical use with your extension officer.</p>
      </form>
    </div>
  );
}

function MessageBubble({ msg, allowTasks, farms }: { msg: ChatMsg; allowTasks?: boolean; farms?: { id: string; name: string }[] }) {
  const isUser = msg.role === "USER";
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", isUser ? "bg-navy-200 text-navy-700" : "bg-ink text-white shadow-sm")}>{isUser ? <User className="size-4" /> : <Bot className="size-4" />}</span>
      <div className={cn("max-w-[88%] space-y-2", isUser && "items-end")}>
        <div className={cn("rounded-2xl px-4 py-3", isUser ? "rounded-tr-md bg-ink text-white" : "rounded-tl-md bg-white shadow-sm ring-1 ring-black/[0.03]")}>
          {isUser ? <p className="whitespace-pre-wrap text-[0.95rem]">{msg.content}</p> : <Markdown text={msg.content} />}
        </div>
        {!isUser && msg.meta && (
          <div className="space-y-2">
            {msg.meta.notice && (
              <p className="flex items-start gap-1.5 rounded-lg bg-harvest-50 px-3 py-2 text-xs text-harvest-800">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> {msg.meta.notice}
              </p>
            )}
            {msg.meta.clarifying_question && (
              <p className="flex items-start gap-1.5 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
                <HelpCircle className="mt-0.5 size-3.5 shrink-0" /> {msg.meta.clarifying_question}
              </p>
            )}
            {msg.meta.uncertainty_note && (
              <p className="flex items-start gap-1.5 text-xs text-navy-500">
                <Info className="mt-0.5 size-3.5 shrink-0" /> {msg.meta.uncertainty_note}
              </p>
            )}
            {allowTasks && msg.meta.suggested_tasks && msg.meta.suggested_tasks.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {msg.meta.suggested_tasks.map((t, i) => (
                  <SuggestedTask key={i} messageId={msg.id} index={i} task={t} farms={farms} />
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {msg.meta.mode === "grok" && <Badge tone="green">Grok</Badge>}
              {msg.meta.mode === "fallback" && <Badge tone="amber">Built-in guidance</Badge>}
              {msg.meta.used_farm_data && (
                <Badge tone="blue">
                  <Database className="size-3" /> Used your farm records
                </Badge>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SuggestedTask({ messageId, index, task, farms }: { messageId: string; index: number; task: { title: string; due_in_days: number; activity_type: string }; farms?: { id: string; name: string }[] }) {
  const [state, setState] = React.useState<"idle" | "adding" | "added">("idle");
  const [due] = React.useState(() => new Date(Date.now() + task.due_in_days * 86400_000).toLocaleDateString("en-ZM", { day: "numeric", month: "short" }));
  return (
    <button
      type="button"
      disabled={state !== "idle" || messageId.startsWith("tmp-")}
      onClick={async () => {
        const ok = window.confirm(`Add this task to your calendar?\n\n"${task.title}"\nDue: ${due}\nType: ${ACTIVITY_LABEL[task.activity_type as keyof typeof ACTIVITY_LABEL] ?? task.activity_type}`);
        if (!ok) return;
        setState("adding");
        const res = await addSuggestedTaskAction(messageId, index, farms?.length === 1 ? farms[0]!.id : undefined);
        if (res.ok) {
          setState("added");
          toast.success("Task added to your calendar.");
        } else {
          setState("idle");
          toast.error(res.error);
        }
      }}
      className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition", state === "added" ? "border-forest-300 bg-forest-100 text-forest-800" : "border-forest-200 bg-white text-forest-800 hover:bg-forest-50")}
    >
      {state === "adding" ? <Loader2 className="size-3.5 animate-spin" /> : <CalendarPlus className="size-3.5" />}
      {state === "added" ? "Added: " : "Suggested task: "}
      {task.title} ({due})
    </button>
  );
}
