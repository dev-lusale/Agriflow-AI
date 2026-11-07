import type { Metadata } from "next";
import { UserDirectory } from "@/components/admin/user-directory";
import { requirePageRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Buyers" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const viewer = await requirePageRole("ADMIN", "SUPER_ADMIN");
  return <UserDirectory viewer={viewer} role="BUYER" title="Buyers" description="Produce buyers: traders, processors, retailers and institutions." searchParams={await searchParams} basePath="/admin/buyers" />;
}
