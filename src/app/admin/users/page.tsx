import type { Metadata } from "next";
import { UserDirectory } from "@/components/admin/user-directory";
import { requirePageRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "User management" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const viewer = await requirePageRole("ADMIN", "SUPER_ADMIN");
  return <UserDirectory viewer={viewer}  title="User management" description="All accounts. Verify identities, suspend accounts, and (super admins) manage administrator permissions." searchParams={await searchParams} basePath="/admin/users" />;
}
