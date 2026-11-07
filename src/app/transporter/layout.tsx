import { RoleShell } from "@/components/layout/role-shell";

export const dynamic = "force-dynamic";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <RoleShell roles={["TRANSPORTER"]}>{children}</RoleShell>;
}
