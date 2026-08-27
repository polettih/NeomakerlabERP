"use client";
import { useMemo, useState } from "react";
import { OrderStatusActions } from "@/components/order-status-actions";
import { OrderDeleteButton } from "@/components/order-delete-button";

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");

type Order = {
  id: string;
  status: string;
  payment_status: string;
  total: number;
  gross_total: number | null;
  order_date: string;
  expected_date: string | null;
  completed_at: string | null;
  customers: { name: string } | null;
  sales_channels: { name: string } | null;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  in_production: "Em produção",
  ready: "Pronto",
  shipped: "Enviado",
  delivered: "Finalizado",
  cancelled: "Cancelado",
};

export function OrderTable({ orders }: { orders: Order[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [payment, setPayment] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const statuses = useMemo(
    () => Array.from(new Set(orders.map((o) => o.status))),
    [orders]
  );
  const payments = useMemo(
    () => Array.from(new Set(orders.map((o) => o.payment_status))),
    [orders]
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (status !== "all" && o.status !== status) return false;
      if (payment !== "all" && o.payment_status !== payment) return false;
      if (from && o.order_date < from) return false;
      if (to && o.order_date > to) return false;
      if (!term) return true;
      return (
        (o.customers?.name ?? "").toLowerCase().includes(term) ||
        (o.sales_channels?.name ?? "").toLowerCase().includes(term)
      );
    });
  }, [orders, q, status, payment, from, to]);

  return (
    <>
      <div className="section-title list-filters">
        <div>
          <p className="muted">
            {filtered.length} de {orders.length} pedido{orders.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="filters-row">
          <input
            className="input"
            placeholder="Buscar por cliente ou canal"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">Todos os status</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s] ?? s}
              </option>
            ))}
          </select>
          <select className="select" value={payment} onChange={(e) => setPayment(e.target.value)}>
            <option value="all">Todo pagamento</option>
            {payments.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <input
            className="input"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            title="De"
          />
          <input
            className="input"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            title="Até"
          />
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Cliente</th>
              <th>Canal</th>
              <th>Prazo</th>
              <th>Conclusão</th>
              <th>Status</th>
              <th>Pagamento</th>
              <th>Venda bruta</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.id}>
                <td>{fmt(o.order_date)}</td>
                <td>{o.customers?.name || "—"}</td>
                <td>{o.sales_channels?.name || "—"}</td>
                <td>{fmt(o.expected_date)}</td>
                <td>{fmt(o.completed_at)}</td>
                <td>
                  <OrderStatusActions id={o.id} status={o.status} />
                </td>
                <td>
                  <span className="badge">{o.payment_status}</span>
                </td>
                <td>{money(Number(o.gross_total ?? o.total))}</td>
                <td>
                  <OrderDeleteButton id={o.id} />
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={9} className="muted">
                  {orders.length
                    ? "Nenhum pedido encontrado com esses filtros."
                    : "Nenhum pedido cadastrado."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
