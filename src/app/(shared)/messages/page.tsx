import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page";
import { Inbox } from "@/components/messaging/inbox";
import { requireUser } from "@/lib/auth/session";
import { listConversations } from "@/server/messaging/service";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage() {
  const user = await requireUser();
  const conversations = await listConversations({ id: user.id, role: user.role });
  return (
    <>
      <PageHeader title="Messages" description="Secure messaging between buyers, farmers, suppliers and transporters. Order threads are created automatically." />
      <div className="max-w-3xl">
        <Inbox conversations={conversations} userId={user.id} />
      </div>
    </>
  );
}
