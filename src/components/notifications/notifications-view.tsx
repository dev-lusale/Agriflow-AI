import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { EmptyState, PageHeader } from "@/components/layout/page";
import { ActionButton } from "@/components/forms/action-form";
import { PreferenceRow } from "./preference-row";
import { cn, relativeTime, titleCase } from "@/lib/utils";
import { getPreferences, listNotifications } from "@/server/notifications/service";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/server/actions/ops";

export async function NotificationsView({ userId }: { userId: string }) {
  const [items, prefs] = await Promise.all([listNotifications(userId, { take: 100 }), getPreferences(userId)]);
  const unread = items.filter((n) => !n.readAt).length;
  return (
    <>
      <PageHeader
        title="Notifications"
        description="In-app alerts about orders, deliveries, stock, weather, tasks and reports."
        actions={
          unread > 0 && (
            <ActionButton variant="outline" action={markAllNotificationsReadAction}>
              <CheckCheck /> Mark all read
            </ActionButton>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div>
          {items.length === 0 ? (
            <EmptyState icon={Bell} title="You're all caught up" />
          ) : (
            <Card className="divide-y divide-border overflow-hidden">
              {items.map((n) => (
                <div key={n.id} className={cn("flex gap-3 px-4 py-3.5", !n.readAt && "bg-forest-50/50")}>
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-forest-500")} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-navy-900">{n.title}</p>
                      <Badge>{titleCase(n.type)}</Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-navy-600">{n.body}</p>
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-navy-400">
                      {relativeTime(n.createdAt)}
                      {n.link && (
                        <Link href={n.link} className="font-semibold text-forest-700 hover:underline">
                          Open
                        </Link>
                      )}
                      {!n.readAt && (
                        <ActionButton variant="link" size="sm" className="h-auto text-xs" action={async () => { "use server"; return markNotificationReadAction(n.id); }}>
                          Mark read
                        </ActionButton>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Notification preferences</CardTitle>
            <p className="text-xs text-navy-500">SMS, WhatsApp and email delivery are designed in but not yet connected. Choices are saved, and messages are queued and marked &quot;not configured&quot;. Nothing is claimed as sent.</p>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="grid grid-cols-[1fr_repeat(4,2.5rem)] gap-1 border-b border-border pb-2 text-center text-[11px] font-semibold uppercase text-navy-400">
              <span className="text-left">Type</span>
              <span>App</span>
              <span>Email</span>
              <span>SMS</span>
              <span>WA</span>
            </div>
            {prefs.map((p) => (
              <PreferenceRow key={p.type} pref={p} />
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
