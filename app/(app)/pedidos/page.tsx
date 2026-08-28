import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { OrderTable, type Order } from "@/components/order-table";

export default async function PedidosPage() {
  const { supabase } = await requireUser();
  const [{ data: orders }, { data: payments }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id,status,payment_status,total,gross_total,order_date,expected_date,completed_at,customers(name),sales_channels(name)"
      )
      .order("order_date", { ascending: false }),
    supabase.from("payments").select("order_id,amount"),
  ]);

  const receivedByOrder = new Map<string, number>();
  for (const p of payments ?? []) {
    if (!p.order_id) continue;
    receivedByOrder.set(p.order_id, (receivedByOrder.get(p.order_id) ?? 0) + Number(p.amount));
  }
  const withReceived = (orders ?? []).map((o) => ({
    ...o,
    received: receivedByOrder.get(o.id) ?? 0,
  }));

  return (
    <div className="content">
      <div className="section-title">
        <div>
          <h1>Pedidos</h1>
          <p className="muted">Acompanhe e altere o status de cada pedido.</p>
        </div>
        <Link className="btn btn-primary" href="/pedidos/novo">
          + Novo pedido
        </Link>
      </div>
      <OrderTable orders={withReceived as unknown as Order[]} />
    </div>
  );
}
