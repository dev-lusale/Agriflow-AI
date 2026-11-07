import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/primitives";
import { EmptyState } from "@/components/layout/page";
import { cn, initials, relativeTime } from "@/lib/utils";
import { ROLE_LABEL } from "@/lib/auth/roles";
import type { listConversations } from "@/server/messaging/service";

export function Inbox({ conversations, userId, activeId }: { conversations: Awaited<ReturnType<typeof listConversations>>; userId: string; activeId?: string }) {
  if (!conversations.length) return <EmptyState icon={MessageSquare} title="No conversations" description="Message a farmer from a listing, or open an order thread." />;
  return (
    <Card className="divide-y divide-border overflow-hidden">
      {conversations.map((c) => {
        const other = c.participants.find((p) => p.userId !== userId)?.user;
        const last = c.messages[0];
        return (
          <Link key={c.id} href={`/messages/${c.id}`} className={cn("flex gap-3 px-4 py-3 hover:bg-navy-50", c.id === activeId && "bg-forest-50")}>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-forest-100 text-sm font-bold text-forest-800">{initials(other?.profile?.fullName ?? "?")}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className={cn("truncate text-sm", c.unread ? "font-bold text-navy-900" : "font-medium text-navy-800")}>
                  {other?.profile?.fullName ?? "User"} <span className="text-xs font-normal text-navy-400">· {other ? ROLE_LABEL[other.role] : ""}</span>
                </p>
                <span className="shrink-0 text-xs text-navy-400">{last ? relativeTime(last.createdAt) : ""}</span>
              </div>
              <p className="truncate text-xs text-navy-500">{c.subject}</p>
              <p className={cn("truncate text-sm", c.unread ? "text-navy-900" : "text-navy-500")}>{last?.body ?? "No messages yet"}</p>
            </div>
            {c.unread && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-forest-500" />}
          </Link>
        );
      })}
    </Card>
  );
}
