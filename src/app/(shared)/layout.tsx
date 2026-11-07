import { RoleShell } from "@/components/layout/role-shell";

export const dynamic = "force-dynamic";

/** Pages shared by every signed-in role (messages, notifications, deliveries). */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <RoleShell roles={[]}>{children}</RoleShell>;
}
