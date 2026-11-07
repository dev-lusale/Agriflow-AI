"use client";

import * as React from "react";
import Link from "next/link";
import { CloudOff, RefreshCw, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import { allOps, onQueueChange, startSyncLoop } from "@/lib/offline/queue";
import { useOnline } from "@/lib/offline/use-online";

/** Header indicator: online/offline state + offline items awaiting sync. */
export function ConnectionStatus() {
  const online = useOnline();
  const [pending, setPending] = React.useState(0);
  const [problems, setProblems] = React.useState(0);

  React.useEffect(() => {
    const refresh = async () => {
      try {
        const ops = await allOps();
        setPending(ops.filter((o) => o.status === "pending" || o.status === "syncing").length);
        setProblems(ops.filter((o) => o.status === "failed" || o.status === "conflict").length);
      } catch {
        /* IndexedDB unavailable */
      }
    };
    void refresh();
    startSyncLoop();
    const unsub = onQueueChange(refresh);
    return () => {
      unsub();
    };
  }, []);

  return (
    <Link
      href="/offline"
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        !online ? "bg-harvest-50 text-harvest-800 ring-harvest-200" : problems ? "bg-red-50 text-red-700 ring-red-200" : pending ? "bg-sky-50 text-sky-700 ring-sky-200" : "bg-forest-50 text-forest-700 ring-forest-200",
      )}
      title="Offline records and sync status"
    >
      {!online ? <CloudOff className="size-3.5" /> : pending ? <RefreshCw className="size-3.5 animate-spin" /> : <Wifi className="size-3.5" />}
      <span className="hidden sm:inline">{!online ? "Offline" : problems ? `${problems} need attention` : pending ? `${pending} syncing` : "Online"}</span>
      {!online && pending > 0 && <span className="rounded-full bg-harvest-200 px-1.5">{pending}</span>}
    </Link>
  );
}
