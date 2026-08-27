import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { OrderStatusActions } from "@/components/order-status-actions";
const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export async function OrderStatusPage({
  title,
  subtitle,
  statuses,
}: {
  title: string;
  subtitle: string;
  statuses: string[];
}) {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("orders")
    .select(
      "id,status,total,order_date,shipped_at,delivered_at,customers(name),sales_channels(name)"
    )
    .in("status", statuses)
    .order("order_date", { ascending: false });
  return (
    <div className="content">
      <div className="section-title">
        <div>
          <h1>{title}</h1>
          <p className="muted">{subtitle}</p>
        </div>
        <Link className="btn btn-primary" href="/pedidos/novo">
          + Novo pedido
        </Link>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Cliente</th>
              <th>Canal</th>
              <th>Status</th>
              <th>Total</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((o: any) => (
              <tr key={o.id}>
                <td>{new Date(o.order_date).toLocaleDateString("pt-BR")}</td>
                <td>{o.customers?.name || "—"}</td>
                <td>{o.sales_channels?.name || "—"}</td>
                <td>
                  <OrderStatusActions id={o.id} status={o.status} />
                </td>
                <td>{money(Number(o.total))}</td>
                <td>
                  <Link className="btn btn-secondary btn-sm" href={`/pedidos`}>
                    Abrir
                  </Link>
                </td>
              </tr>
            ))}
            {!data?.length && (
              <tr>
                <td colSpan={6} className="muted">
                  Nenhum pedido nesta etapa.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
