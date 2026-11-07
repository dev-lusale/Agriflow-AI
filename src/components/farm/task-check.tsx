"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { setTaskStatusAction } from "@/server/actions/farm";
import { enqueue } from "@/lib/offline/queue";
import { cn } from "@/lib/utils";

/** Task completion checkbox. Works offline: completion is queued and synced later. */
export function TaskCheck({ id, done, title }: { id: string; done: boolean; title?: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label={done ? "Mark as not done" : "Mark as done"}
      disabled={pending}
      onClick={() =>
        start(async () => {
          if (!navigator.onLine && !done) {
            await enqueue("task.complete", { id }, `Complete task: ${title ?? "task"}`);
            toast.info("Saved on this device. Will sync when you are back online.");
            return;
          }
          const res = await setTaskStatusAction(id, done ? "PENDING" : "DONE");
          if (res.ok) {
            toast.success(res.message ?? "Updated");
            router.refresh();
          } else toast.error(res.error);
        })
      }
      className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition", done ? "border-forest-600 bg-forest-600 text-white" : "border-navy-300 hover:border-forest-500")}
    >
      {pending ? <Loader2 className="size-3 animate-spin" /> : done ? <Check className="size-3" strokeWidth={3} /> : null}
    </button>
  );
}
