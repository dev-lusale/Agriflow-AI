import type { Metadata } from "next";
import { NotificationsView } from "@/components/notifications/notifications-view";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Notifications" };

export default async function Page() {
  const user = await requireUser();
  return <NotificationsView userId={user.id} />;
}
