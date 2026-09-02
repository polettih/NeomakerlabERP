"use client";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { resolveChannelFee, type ChannelTier } from "@/lib/pricing";
type P = {
  id: string;
  name: string;
  sale_price: number;
  estimated_cost: number;
  category?: string;
  product_images?: { public_url: string; sort_order: number }[];
};
type C = { id: string; name: string };
type Ch = { id: string; name: string; fee_percent: number; fixed_fee: number };
type Tier = ChannelTier & { channel_id: string };
const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function CreateOrderForm({
  customers,
  products,
  channels,
  tiers,
}: {
  customers: C[];
  products: P[];
  channels: Ch[];
  tiers: Tier[];
}) {
  const r = useRouter();
  const [customer, setCustomer] = useState("");
  const [channel, setChannel] = useState("");
  const [product, setProduct] = useState(products[0]?.id || "");
  const [qty, setQty] = useState(1);
  const [discount, setDiscount] = useState(0);
  const [shipping, setShipping] = useState(0);
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState("new");
  const [completedDate, setCompletedDate] = useState("");
  const [error, setError] = useState("");
  const selected = products.find((p) => p.id === product);
  const selectedChannel = channels.find((c) => c.id === channel);
  const selectedTiers = useMemo(
    () => tiers.filter((t) => t.channel_id === channel),
    [tiers, channel]
  );
  const calc = useMemo(() => {
    const subtotal = (selected?.sale_price || 0) * qty;
    const merchandise = Math.max(subtotal - discount, 0);
    // Mesma função usada pelo servidor ao salvar o pedido (lib/pricing.ts) — a prévia
    // que o usuário vê aqui é garantidamente igual ao que será gravado.
    const { fee } = selectedChannel
      ? resolveChannelFee(merchandise, selectedChannel, selectedTiers)
      : { fee: 0 };
    const gross = merchandise + fee + shipping;
    return { subtotal, merchandise, fee, gross };
  }, [selected, qty, discount, shipping, selectedChannel, selectedTiers]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (status === "delivered" && !completedDate) {
      setError("Informe a data de conclusão do pedido.");
      return;
    }
    const completedAt = completedDate ? new Date(`${completedDate}T12:00:00`).toISOString() : null;
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_id: customer || null,
        sales_channel_id: channel || null,
        discount,
        shipping_cost: shipping,
        order_date: new Date(`${orderDate}T12:00:00`).toISOString(),
        status,
        completed_at: completedAt,
        items: [{ product_id: product, quantity: qty }],
      }),
    });
    const j = await res.json();
    if (!res.ok) setError(j.error || "Erro");
    else r.push("/pedidos");
  }
  return (
    <form onSubmit={submit} className="card grid" style={{ maxWidth: 900 }}>
      {error && <div className="error">{error}</div>}
      <div className="form-grid">
        <div className="field">
          <label>Cliente</label>
          <select className="select" value={customer} onChange={(e) => setCustomer(e.target.value)}>
            <option value="">Sem cliente</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Canal de venda</label>
          <select className="select" value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="">Venda direta — sem taxa</option>
            {channels.map((c) => {
              const hasTiers = tiers.some((t) => t.channel_id === c.id);
              return (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {hasTiers
                    ? " — taxa por faixa de preço"
                    : ` — ${(Number(c.fee_percent) * 100).toFixed(2)}%${
                        Number(c.fixed_fee) > 0 ? ` + ${money(Number(c.fixed_fee))}` : ""
                      }`}
                </option>
              );
            })}
          </select>
        </div>
        <div className="field">
          <label>Produto</label>
          <select className="select" value={product} onChange={(e) => setProduct(e.target.value)}>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {money(Number(p.sale_price))}
              </option>
            ))}
          </select>
          {selected?.product_images?.length ? (
            <div className="product-preview">
              <img
                className="product-thumb"
                src={
                  [...selected.product_images].sort((a, b) => a.sort_order - b.sort_order)[0]
                    .public_url
                }
                alt=""
              />
              <div>
                <strong>{selected.name}</strong>
                <div className="muted">{selected.category || "Bonecos"}</div>
              </div>
            </div>
          ) : null}
        </div>
        <div className="field">
          <label>Quantidade</label>
          <input
            className="input"
            type="number"
            min="1"
            value={qty}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
        <div className="field">
          <label>Desconto</label>
          <input
            className="input"
            type="number"
            step="0.01"
            min="0"
            value={discount}
            onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
          />
        </div>
        <div className="field">
          <label>Frete cobrado do cliente</label>
          <input
            className="input"
            type="number"
            step="0.01"
            min="0"
            value={shipping}
            onChange={(e) => setShipping(Math.max(0, Number(e.target.value) || 0))}
          />
        </div>
        <div className="field">
          <label>Data da venda</label>
          <input
            className="input"
            type="date"
            value={orderDate}
            onChange={(e) => setOrderDate(e.target.value)}
          />
          <p className="muted">Use esta data também para cadastrar vendas antigas.</p>
        </div>
        <div className="field">
          <label>Status inicial</label>
          <select
            className="select"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              if (e.target.value !== "delivered") setCompletedDate("");
            }}
          >
            <option value="new">Novo</option>
            <option value="preparation">Preparação</option>
            <option value="production">Produção</option>
            <option value="finishing">Acabamento</option>
            <option value="packaging">Embalagem</option>
            <option value="shipped">Enviado</option>
            <option value="delivered">Finalizado</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>
        {status === "delivered" && (
          <div className="field">
            <label>Data de conclusão</label>
            <input
              className="input"
              type="date"
              value={completedDate}
              onChange={(e) => setCompletedDate(e.target.value)}
            />
            <p className="muted">Essa data será usada no calendário e no histórico do pedido.</p>
          </div>
        )}
      </div>
      <div className="card" style={{ background: "#0f1318" }}>
        <div className="label">Resumo da venda</div>
        <div
          className="grid"
          style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8, marginTop: 10 }}
        >
          <div>
            Produtos: <strong>{money(calc.subtotal)}</strong>
          </div>
          <div>
            Desconto: <strong>- {money(discount)}</strong>
          </div>
          <div>
            Taxa do canal: <strong>{money(calc.fee)}</strong>
          </div>
          <div>
            Frete: <strong>{money(shipping)}</strong>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <div className="label">Venda bruta</div>
          <div className="value">{money(calc.gross)}</div>
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          A taxa do marketplace é adicionada ao valor cobrado do cliente. O percentual e a taxa fixa
          vêm de Configurações.
        </p>
      </div>
      <button className="btn btn-primary">Criar pedido</button>
    </form>
  );
}
