import type { Role } from "@prisma/client";
import { requirePageRole } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { unreadCount } from "@/server/notifications/service";
import { unreadConversationCount } from "@/server/messaging/service";
import { getSetting } from "@/server/admin/settings";
import { AppShell } from "./app-shell";

/** Server-side guard + shell for every authenticated area. Roles are enforced here, not in the browser. */
export async function RoleShell({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const user = await requirePageRole(...roles);
  const [notifications, messages, banner] = await Promise.all([unreadCount(user.id), unreadConversationCount(user.id), getSetting<string>("platform.maintenanceBanner", "")]);
  return (
    <AppShell role={user.role} name={user.profile?.fullName ?? user.email} email={user.email} unreadNotifications={notifications} unreadMessages={messages} demoMode={env.demoMode}>
      {banner ? <div role="status" className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm text-sky-900">{banner}</div> : null}
      {children}
    </AppShell>
  );
}
