import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { OrderTable, type Order } from "@/components/order-table";
import type { Payment } from "@/components/order-payments";

export default async function PedidosPage() {
  const { supabase } = await requireUser();
  const [{ data: orders }, { data: payments }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id,status,payment_status,total,gross_total,order_date,expected_date,completed_at,customers(name),sales_channels(name)"
      )
      .order("order_date", { ascending: false }),
    supabase
      .from("payments")
      .select("id,order_id,amount,payment_method,payment_date")
      .order("payment_date", { ascending: false }),
  ]);

  const paymentsByOrder = new Map<string, Payment[]>();
  for (const p of payments ?? []) {
    if (!p.order_id) continue;
    const list = paymentsByOrder.get(p.order_id) ?? [];
    list.push(p as Payment);
    paymentsByOrder.set(p.order_id, list);
  }
  const withPayments = (orders ?? []).map((o) => {
    const list = paymentsByOrder.get(o.id) ?? [];
    return { ...o, payments: list, received: list.reduce((s, p) => s + Number(p.amount), 0) };
  });

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
      <OrderTable orders={withPayments as unknown as Order[]} />
    </div>
  );
}
