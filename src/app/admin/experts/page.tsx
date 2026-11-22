import type { Metadata } from "next";
import { UserDirectory } from "@/components/admin/user-directory";
import { requirePageRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Agricultural experts" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const viewer = await requirePageRole("ADMIN", "SUPER_ADMIN");
  return <UserDirectory viewer={viewer} role="EXPERT" title="Agricultural experts" description="Verify experts before they can see farmers' crop-health cases." searchParams={await searchParams} basePath="/admin/experts" />;
}
