import Link from "next/link";
import { CheckCircle2, Circle, MessageSquare, Truck } from "lucide-react";
import type { OrderStatus } from "@prisma/client";
import { Badge, Card, CardContent, CardHeader, CardTitle, Table, THead, TBody, TR, TH, TD, Alert } from "@/components/ui/primitives";
import { KeyValue, StatusBadge } from "@/components/layout/page";
import { ActionButton, ActionForm, SubmitButton, TextField, TextAreaField } from "@/components/forms/action-form";
import { FormDialog } from "@/components/forms/form-dialog";
import { DeliveryRequestForm } from "@/components/orders/delivery-request-form";
import { Button } from "@/components/ui/button";
import type { Actor } from "@/lib/action";
import { formatZMW } from "@/lib/money";
import { DELIVERY_STATUS_LABEL, ORDER_FLOW, ORDER_STATUS_LABEL, UNIT_LABEL } from "@/lib/labels";
import { cn, formatDateTime, formatNumber } from "@/lib/utils";
import { availableActions, partyFor, type OrderDetail } from "@/server/orders/service";
import { transitionLabel } from "@/server/orders/machine";
import { acceptOfferAction, counterOfferAction, transitionOrderAction } from "@/server/actions/market";

const NOTE_REQUIRED: OrderStatus[] = ["CANCELLED", "DISPUTED", "REJECTED"];

export function OrderView({ order, actor, deliveriesHref }: { order: OrderDetail; actor: Actor; deliveriesHref: string }) {
  let party: ReturnType<typeof partyFor> | "TRANSPORTER" = "TRANSPORTER";
  try {
    party = partyFor(actor, order);
  } catch {
    /* transporter view */
  }
  const actions = party === "TRANSPORTER" ? [] : availableActions(actor, order);
  const item = order.items[0];
  const openOffer = [...order.offers].reverse().find((o) => o.status === "OPEN");
  const canRespondToOffer = openOffer && openOffer.offeredById !== actor.id && party !== "ADMIN" && (order.status === "NEGOTIATING" || (order.status === "PENDING" && party === "SELLER"));
  const canCounter = order.type === "PRODUCE" && party !== "ADMIN" && party !== "TRANSPORTER" && (order.status === "NEGOTIATING" || (order.status === "PENDING" && party === "SELLER")) && openOffer?.offeredById !== actor.id;
  const flowIndex = ORDER_FLOW.indexOf(order.status);
  const counterparty = party === "BUYER" ? order.seller : order.buyer;
  const counterName = (party === "BUYER" ? order.seller.supplierProfile?.businessName : order.buyer.buyerProfile?.businessName) ?? counterparty.profile?.fullName;
  const canRequestDelivery = (party === "BUYER" || party === "SELLER") && ["CONFIRMED", "PROCESSING", "READY_FOR_PICKUP"].includes(order.status) && !order.deliveries.some((d) => d.status !== "CANCELLED" && d.status !== "DELIVERED");

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {/* Progress */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs text-navy-500">{order.type === "PRODUCE" ? "Produce order" : "Input purchase order"} · created {formatDateTime(order.createdAt)}</p>
                <p className="mt-1 text-2xl font-bold">{formatZMW(order.total)}</p>
              </div>
              <div className="flex items-center gap-2">
                {order.isDemo && <Badge tone="amber">Demo</Badge>}
                <StatusBadge status={order.status} label={ORDER_STATUS_LABEL[order.status]} />
              </div>
            </div>
            <ol className="mt-5 grid grid-cols-4 gap-y-3 sm:grid-cols-8">
              {ORDER_FLOW.map((s, i) => {
                const done = flowIndex >= i && flowIndex !== -1;
                return (
                  <li key={s} className="flex flex-col items-center text-center">
                    {done ? <CheckCircle2 className="size-5 text-forest-600" /> : <Circle className="size-5 text-navy-300" />}
                    <span className={cn("mt-1 text-[11px] leading-tight", done ? "font-medium text-forest-800" : "text-navy-400")}>{ORDER_STATUS_LABEL[s]}</span>
                  </li>
                );
              })}
            </ol>
            {["CANCELLED", "REJECTED", "DISPUTED", "NEGOTIATING"].includes(order.status) && (
              <Alert tone={order.status === "NEGOTIATING" ? "blue" : order.status === "DISPUTED" ? "amber" : "red"} className="mt-4">
                {order.status === "NEGOTIATING" ? "Price negotiation in progress." : `${ORDER_STATUS_LABEL[order.status]}${order.cancelReason ? `: ${order.cancelReason}` : "."}`}
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <THead>
                <tr>
                  <TH>Item</TH>
                  <TH>Quantity</TH>
                  <TH>Unit price</TH>
                  <TH className="text-right">Line total</TH>
                </tr>
              </THead>
              <TBody>
                {order.items.map((i) => (
                  <TR key={i.id}>
                    <TD>
                      {i.listing ? (
                        <Link href={`/marketplace/${i.listing.id}`} className="font-medium text-navy-900 hover:text-forest-700">
                          {i.description}
                        </Link>
                      ) : (
                        <span className="font-medium text-navy-900">{i.description}</span>
                      )}
                    </TD>
                    <TD>
                      {formatNumber(i.quantity.toString())} {UNIT_LABEL[i.unit]}
                    </TD>
                    <TD>{formatZMW(i.unitPrice)}</TD>
                    <TD className="text-right font-semibold">{formatZMW(i.lineTotal)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <p className="px-5 pt-3 text-xs text-navy-500">Payment is settled directly between buyer and seller (e.g. mobile money). AgriFlow does not process payments in this version.</p>
          </CardContent>
        </Card>

        {/* Negotiation */}
        {order.type === "PRODUCE" && (
          <Card>
            <CardHeader>
              <CardTitle>Negotiation history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-2">
                {order.offers.map((o) => (
                  <li key={o.id} className={cn("flex items-start justify-between gap-3 rounded-xl border p-3 text-sm", o.status === "OPEN" ? "border-sky-200 bg-sky-50" : o.status === "ACCEPTED" ? "border-forest-200 bg-forest-50" : "border-border")}>
                    <div>
                      <p className="font-medium">
                        {o.offeredBy.id === actor.id ? "You" : o.offeredBy.profile?.fullName} offered {formatZMW(o.pricePerUnit)} × {formatNumber(o.quantity.toString())}
                      </p>
                      {o.message && <p className="mt-0.5 text-navy-600">“{o.message}”</p>}
                      <p className="mt-0.5 text-xs text-navy-500">{formatDateTime(o.createdAt)}{o.isInitial ? " · initial request" : ""}</p>
                    </div>
                    <StatusBadge status={o.status} />
                  </li>
                ))}
              </ul>
              {(canRespondToOffer || canCounter) && (
                <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                  {canRespondToOffer && (
                    <ActionButton action={async () => { "use server"; return acceptOfferAction(order.id); }} confirm={`Accept ${formatZMW(openOffer!.pricePerUnit)} × ${openOffer!.quantity.toString()}?`}>
                      Accept this offer
                    </ActionButton>
                  )}
                  {canCounter && (
                    <FormDialog trigger="Make a counteroffer" title="Counteroffer" variant="outline" description="The other party can accept, counter, or reject.">
                      <ActionForm action={counterOfferAction} className="grid gap-4 sm:grid-cols-2">
                        <input type="hidden" name="orderId" value={order.id} />
                        <TextField name="pricePerUnit" label={`Price per ${item ? UNIT_LABEL[item.unit] : "unit"} (ZMW)`} type="number" step="0.01" min={0} required defaultValue={openOffer?.pricePerUnit.toString()} />
                        <TextField name="quantity" label="Quantity" type="number" step="0.01" min={0} required defaultValue={openOffer?.quantity.toString() ?? item?.quantity.toString()} />
                        <TextAreaField name="message" label="Message" className="sm:col-span-2" rows={2} />
                        <div className="sm:col-span-2">
                          <SubmitButton>Send counteroffer</SubmitButton>
                        </div>
                      </ActionForm>
                    </FormDialog>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Order history</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="relative space-y-4 border-l border-border pl-5">
              {order.events.map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[25px] top-1 size-2.5 rounded-full bg-forest-500 ring-4 ring-white" />
                  <p className="text-sm font-medium">{ORDER_STATUS_LABEL[e.toStatus]}</p>
                  <p className="text-xs text-navy-500">
                    {formatDateTime(e.createdAt)} · {e.actor?.profile?.fullName ?? "System"}
                    {e.note ? ` · ${e.note}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        {actions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {actions.map((to) => (
                <ActionButton
                  key={to}
                  variant={NOTE_REQUIRED.includes(to) ? "danger-outline" : "default"}
                  action={async (note?: string) => {
                    "use server";
                    return transitionOrderAction(order.id, to, note);
                  }}
                  promptNote={NOTE_REQUIRED.includes(to) ? "Please give a reason:" : undefined}
                  confirm={!NOTE_REQUIRED.includes(to) ? `${transitionLabel(to, party as never, order.status)}?` : undefined}
                >
                  {transitionLabel(to, party as never, order.status)}
                </ActionButton>
              ))}
              {party === "BUYER" && order.status === "ACCEPTED" && <p className="text-xs text-navy-500">Confirming reserves the stock and commits you to the agreed price.</p>}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{party === "BUYER" ? "Seller" : party === "SELLER" ? "Buyer" : "Parties"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {party === "ADMIN" || party === "TRANSPORTER" ? (
              <KeyValue
                className="sm:grid-cols-1"
                items={[
                  ["Buyer", order.buyer.buyerProfile?.businessName ?? order.buyer.profile?.fullName],
                  ["Seller", order.seller.supplierProfile?.businessName ?? order.seller.profile?.fullName],
                ]}
              />
            ) : (
              <KeyValue
                className="sm:grid-cols-1"
                items={[
                  ["Name", counterName],
                  ["Location", `${counterparty.profile?.district ?? "—"}`],
                  // Contact details only shared once a deal is agreed
                  ["Phone", ["CONFIRMED", "PROCESSING", "READY_FOR_PICKUP", "IN_TRANSIT", "DELIVERED", "COMPLETED"].includes(order.status) ? (counterparty.phone ?? "—") : "Shared after confirmation"],
                ]}
              />
            )}
            {order.deliveryAddress && <KeyValue className="sm:grid-cols-1" items={[["Delivery address", order.deliveryAddress]]} />}
            {order.conversations[0] && party !== "ADMIN" && party !== "TRANSPORTER" && (
              <Button asChild variant="outline" className="w-full">
                <Link href={`/messages/${order.conversations[0].id}`}>
                  <MessageSquare /> Message
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Truck className="size-4 text-forest-600" /> Delivery
            </CardTitle>
            <Link href={deliveriesHref} className="text-xs font-semibold text-forest-700 hover:underline">
              All deliveries
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {order.deliveries.length === 0 && <p className="text-sm text-navy-500">No transport arranged yet.</p>}
            {order.deliveries.map((d) => (
              <Link key={d.id} href={`/deliveries/${d.id}`} className="block rounded-xl border border-border p-3 hover:bg-navy-50">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{d.deliveryNumber}</span>
                  <StatusBadge status={d.status} label={DELIVERY_STATUS_LABEL[d.status]} />
                </div>
                <p className="mt-1 text-xs text-navy-500">
                  {d.transporter?.transporterProfile?.businessName ?? "Awaiting a transporter"}
                  {d.fee ? ` · ${formatZMW(d.fee)}` : ""}
                </p>
              </Link>
            ))}
            {canRequestDelivery && (
              <FormDialog trigger={<><Truck /> Request transport</>} title="Request transport" description="Transporters serving the pickup province will be notified." wide variant="secondary">
                <DeliveryRequestForm orderId={order.id} cargo={order.items.map((i) => `${formatNumber(i.quantity.toString())} ${UNIT_LABEL[i.unit]} ${i.description}`).join(", ")} pickup={{ province: order.seller.profile?.province ?? null, district: order.seller.profile?.district ?? null }} dropoff={{ province: order.buyer.profile?.province ?? null, district: order.buyer.profile?.district ?? null }} />
              </FormDialog>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
