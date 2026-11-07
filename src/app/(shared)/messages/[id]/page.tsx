import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card } from "@/components/ui/primitives";
import { PageHeader } from "@/components/layout/page";
import { Inbox } from "@/components/messaging/inbox";
import { Composer } from "@/components/messaging/composer";
import { requireUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { cn, formatDateTime } from "@/lib/utils";
import { getConversation, listConversations } from "@/server/messaging/service";

export const metadata: Metadata = { title: "Conversation" };

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const actor = { id: user.id, role: user.role };
  let conv;
  try {
    conv = await getConversation(actor, id);
  } catch (e) {
    if (e instanceof AppError) notFound();
    throw e;
  }
  const conversations = await listConversations(actor);
  const other = conv.participants.find((p) => p.userId !== user.id)?.user;
  const orderHref = conv.order ? (user.role === "BUYER" ? `/buyer/orders/${conv.order.id}` : user.role === "SUPPLIER" ? `/supplier/orders/${conv.order.id}` : `/farmer/orders/${conv.order.id}`) : null;
  return (
    <>
      <PageHeader back={{ href: "/messages", label: "Messages" }} title={other?.profile?.fullName ?? "Conversation"} description={conv.subject} />
      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <div className="hidden lg:block">
          <Inbox conversations={conversations} userId={user.id} activeId={conv.id} />
        </div>
        <Card className="flex h-[calc(100dvh-14rem)] min-h-[420px] flex-col overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5 text-xs">
            {conv.order && orderHref && (
              <Link href={orderHref} className="font-semibold text-forest-700 hover:underline">
                Order {conv.order.orderNumber}
              </Link>
            )}
            {conv.order && <Badge>{conv.order.status.toLowerCase().replaceAll("_", " ")}</Badge>}
            {conv.listing && (
              <Link href={`/marketplace/${conv.listing.id}`} className="font-semibold text-forest-700 hover:underline">
                {conv.listing.title}
              </Link>
            )}
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {conv.messages.map((m) => {
              const mine = m.senderId === user.id;
              return (
                <div key={m.id} className={cn("flex", mine && "justify-end")}>
                  <div className={cn("max-w-[80%] rounded-2xl px-4 py-2.5", mine ? "rounded-br-md bg-ink text-white" : "rounded-bl-sm bg-navy-100 text-navy-900")}>
                    <p className="whitespace-pre-wrap text-sm">{m.body}</p>
                    <p className={cn("mt-1 text-[10px]", mine ? "text-forest-200" : "text-navy-400")}>
                      {mine ? "You" : m.sender.profile?.fullName} · {formatDateTime(m.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
            {!conv.messages.length && <p className="text-center text-sm text-navy-500">No messages yet. Say hello.</p>}
          </div>
          <Composer conversationId={conv.id} />
        </Card>
      </div>
    </>
  );
}
