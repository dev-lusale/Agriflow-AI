"use client";

import * as React from "react";
import { toast } from "sonner";
import { setNotificationPreferenceAction } from "@/server/actions/ops";

type Pref = { type: string; label: string; inApp: boolean; email: boolean; sms: boolean; whatsapp: boolean };

export function PreferenceRow({ pref }: { pref: Pref }) {
  const [state, setState] = React.useState(pref);
  const [pending, start] = React.useTransition();
  const toggle = (k: "inApp" | "email" | "sms" | "whatsapp") => {
    const next = { ...state, [k]: !state[k] };
    setState(next);
    start(async () => {
      const fd = new FormData();
      fd.set("type", pref.type);
      (["inApp", "email", "sms", "whatsapp"] as const).forEach((x) => next[x] && fd.set(x, "on"));
      const res = await setNotificationPreferenceAction(fd);
      if (!res.ok) {
        toast.error(res.error);
        setState(state);
      }
    });
  };
  return (
    <div className="grid grid-cols-[1fr_repeat(4,2.5rem)] items-center gap-1 py-1.5 text-sm">
      <span className="text-navy-700">{pref.label}</span>
      {(["inApp", "email", "sms", "whatsapp"] as const).map((k) => (
        <label key={k} className="flex justify-center">
          <input type="checkbox" checked={state[k]} disabled={pending} onChange={() => toggle(k)} className="size-4 accent-forest-700" aria-label={`${pref.label}: ${k}`} />
        </label>
      ))}
    </div>
  );
}
