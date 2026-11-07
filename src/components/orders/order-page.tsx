import { notFound } from "next/navigation";
import type { Role } from "@prisma/client";
import { PageHeader } from "@/components/layout/page";
import { OrderView } from "@/components/orders/order-view";
import { requirePageRole } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { getOrder } from "@/server/orders/service";

/** Shared order detail page body for every role (authorisation enforced in getOrder). */
export async function OrderPage({ id, roles, back, deliveriesHref }: { id: string; roles: Role[]; back: { href: string; label: string }; deliveriesHref: string }) {
  const user = await requirePageRole(...roles);
  const actor = { id: user.id, role: user.role };
  let order;
  try {
    order = await getOrder(actor, id);
  } catch (e) {
    if (e instanceof AppError) notFound();
    throw e;
  }
  return (
    <>
      <PageHeader back={back} title={`Order ${order.orderNumber}`} />
      <OrderView order={order} actor={actor} deliveriesHref={deliveriesHref} />
    </>
  );
}
