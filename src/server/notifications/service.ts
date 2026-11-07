import "server-only";
import type { NotificationType } from "@prisma/client";
import { prisma, type Tx } from "@/lib/db";

export type NotifyInput = { type: NotificationType; title: string; body: string; link?: string };

/**
 * Create an in-app notification (respecting the user's preference).
 * External channels (SMS/WhatsApp/email) are queued as NOT_CONFIGURED until a provider is connected.
 */
export async function notify(userId: string, n: NotifyInput, tx: Tx = prisma) {
  const pref = await tx.notificationPreference.findUnique({ where: { userId_type: { userId, type: n.type } } });
  const inApp = pref?.inApp ?? true;
  let created = null;
  if (inApp) {
    created = await tx.notification.create({
      data: { userId, type: n.type, title: n.title.slice(0, 160), body: n.body.slice(0, 1000), link: n.link },
    });
  }
  const external: Array<"SMS" | "WHATSAPP"> = [];
  if (pref?.sms) external.push("SMS");
  if (pref?.whatsapp) external.push("WHATSAPP");
  if (external.length) {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { phone: true } });
    if (user?.phone) {
      await tx.outboundMessage.createMany({
        data: external.map((channel) => ({
          userId,
          channel,
          recipient: user.phone!,
          body: `${n.title}: ${n.body}`.slice(0, 480),
          status: "NOT_CONFIGURED" as const,
        })),
      });
    }
  }
  return created;
}

export async function notifyMany(userIds: string[], n: NotifyInput, tx: Tx = prisma) {
  for (const id of new Set(userIds)) await notify(id, n, tx);
}

export async function listNotifications(userId: string, opts: { unreadOnly?: boolean; take?: number } = {}) {
  return prisma.notification.findMany({
    where: { userId, ...(opts.unreadOnly ? { readAt: null } : {}) },
    orderBy: { createdAt: "desc" },
    take: opts.take ?? 50,
  });
}

export async function unreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markRead(userId: string, id: string) {
  // updateMany scoped by userId → users can only mark their own notifications
  return prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
}

export async function markAllRead(userId: string) {
  return prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}

export const PREFERENCE_TYPES: { type: NotificationType; label: string }[] = [
  { type: "PURCHASE_REQUEST", label: "Purchase requests" },
  { type: "ORDER_UPDATE", label: "Order updates" },
  { type: "NEGOTIATION_OFFER", label: "Negotiation offers" },
  { type: "NEW_MESSAGE", label: "New messages" },
  { type: "DELIVERY_UPDATE", label: "Delivery updates" },
  { type: "LOW_INVENTORY", label: "Low inventory alerts" },
  { type: "WEATHER_ALERT", label: "Weather alerts" },
  { type: "TASK_REMINDER", label: "Farm task reminders" },
  { type: "HARVEST_REMINDER", label: "Harvest reminders" },
  { type: "AI_REPORT", label: "New AI reports" },
];

export async function getPreferences(userId: string) {
  const prefs = await prisma.notificationPreference.findMany({ where: { userId } });
  return PREFERENCE_TYPES.map((p) => {
    const found = prefs.find((x) => x.type === p.type);
    return { ...p, inApp: found?.inApp ?? true, email: found?.email ?? false, sms: found?.sms ?? false, whatsapp: found?.whatsapp ?? false };
  });
}

export async function setPreference(userId: string, type: NotificationType, values: { inApp: boolean; email: boolean; sms: boolean; whatsapp: boolean }) {
  return prisma.notificationPreference.upsert({
    where: { userId_type: { userId, type } },
    create: { userId, type, ...values },
    update: values,
  });
}
