import type { Metadata } from "next";
import { UserDirectory } from "@/components/admin/user-directory";
import { requirePageRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Suppliers" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const viewer = await requirePageRole("ADMIN", "SUPER_ADMIN");
  return <UserDirectory viewer={viewer} role="SUPPLIER" title="Suppliers" description="Agricultural input suppliers and their product activity." searchParams={await searchParams} basePath="/admin/suppliers" />;
}
