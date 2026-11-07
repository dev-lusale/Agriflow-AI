import { OrderPage } from "@/components/orders/order-page";

export const metadata = { title: "Order" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderPage id={id} roles={["BUYER"]} back={{ href: "/buyer/orders", label: "Orders" }} deliveriesHref="/buyer/deliveries" />;
}
