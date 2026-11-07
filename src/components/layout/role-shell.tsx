import type { Role } from "@prisma/client";
import { requirePageRole } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { unreadCount } from "@/server/notifications/service";
import { unreadConversationCount } from "@/server/messaging/service";
import { AppShell } from "./app-shell";

/** Server-side guard + shell for every authenticated area. Roles are enforced here, not in the browser. */
export async function RoleShell({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const user = await requirePageRole(...roles);
  const [notifications, messages] = await Promise.all([unreadCount(user.id), unreadConversationCount(user.id)]);
  return (
    <AppShell role={user.role} name={user.profile?.fullName ?? user.email} email={user.email} unreadNotifications={notifications} unreadMessages={messages} demoMode={env.demoMode}>
      {children}
    </AppShell>
  );
}
