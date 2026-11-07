"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DialogCloseContext } from "@/components/forms/form-dialog";

/** After a successful purchase request, ActionForm calls the dialog-close context; we use it to navigate to the new order. */
export function PurchaseRedirect({ ordersHref, children }: { ordersHref: string; children: React.ReactNode }) {
  const router = useRouter();
  return <DialogCloseContext.Provider value={() => router.push(ordersHref)}>{children}</DialogCloseContext.Provider>;
}
