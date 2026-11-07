import type { Metadata } from "next";
import { ProfileView } from "@/components/profile/profile-view";
import { requirePageRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Profile" };

export default async function Page() {
  const user = await requirePageRole("BUYER");
  return <ProfileView user={user} />;
}
