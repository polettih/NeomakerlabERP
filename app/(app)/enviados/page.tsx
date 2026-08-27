import { OrderStatusPage } from "@/components/order-status-page";
export default async function Page() {
  return (
    <OrderStatusPage
      title="Enviados"
      subtitle="Pedidos que já foram enviados."
      statuses={["shipped"]}
    />
  );
}
