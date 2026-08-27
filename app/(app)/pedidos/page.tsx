import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { OrderTable } from "@/components/order-table";

export default async function PedidosPage() {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("orders")
    .select(
      "id,status,payment_status,total,gross_total,order_date,expected_date,completed_at,customers(name),sales_channels(name)"
    )
    .order("order_date", { ascending: false });
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
      <OrderTable orders={(data ?? []) as any} />
    </div>
  );
}
