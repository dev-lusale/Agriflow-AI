import type { Metadata } from "next";
import { UserDirectory } from "@/components/admin/user-directory";
import { requirePageRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Transporters" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const viewer = await requirePageRole("ADMIN", "SUPER_ADMIN");
  return <UserDirectory viewer={viewer} role="TRANSPORTER" title="Transporters" description="Logistics providers and their delivery activity." searchParams={await searchParams} basePath="/admin/transporters" />;
}
