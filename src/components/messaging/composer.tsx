"use client";

import { SendHorizonal } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Textarea } from "@/components/ui/primitives";
import { sendMessageAction } from "@/server/actions/market";

export function Composer({ conversationId }: { conversationId: string }) {
  return (
    <ActionForm action={sendMessageAction} resetOnSuccess className="flex items-end gap-2 border-t border-border bg-navy-50/60 p-3">
      <input type="hidden" name="conversationId" value={conversationId} />
      <Textarea name="body" required rows={1} maxLength={4000} placeholder="Write a message…" className="min-h-[44px] flex-1 resize-none bg-white" aria-label="Message" />
      <SubmitButton size="icon" aria-label="Send">
        <SendHorizonal />
      </SubmitButton>
    </ActionForm>
  );
}
