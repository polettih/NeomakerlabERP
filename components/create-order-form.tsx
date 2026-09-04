"use client";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/format";
import { resolveFeeBand, type FeeBand } from "@/lib/fee-bands";
type P = {
  id: string;
  name: string;
  sale_price: number;
  estimated_cost: number;
  category?: string;
  product_images?: { public_url: string; sort_order: number }[];
};
type C = { id: string; name: string };
type Ch = { id: string; name: string; fee_percent: number; fixed_fee: number; fee_bands: FeeBand[] };
export function CreateOrderForm({
  customers,
  products,
  channels,
}: {
  customers: C[];
  products: P[];
  channels: Ch[];
}) {
  const r = useRouter();
  const [customer, setCustomer] = useState("");
  const [channel, setChannel] = useState("");
  const [product, setProduct] = useState(products[0]?.id || "");
  const [qty, setQty] = useState(1);
  const [unitPrice, setUnitPrice] = useState(() => products[0]?.sale_price ?? 0);
  const [priceTouched, setPriceTouched] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [shipping, setShipping] = useState(0);
  const [campaignFee, setCampaignFee] = useState(0);
  // Como a taxa do canal se relaciona com o valor digitado:
  // "add"  → o valor digitado é o preço líquido; a taxa é somada por cima para chegar
  //          no total cobrado do cliente (comportamento antigo/padrão).
  // "subtract" → o valor digitado já é o preço final, igual ao que aparece no anúncio
  //          da Shopee/TikTok Shop; a taxa é descontada dele, e é isso que sobra de
  //          receita líquida no Financeiro. O cliente nunca paga a mais por causa da
  //          taxa nesse modo.
  const [feeMode, setFeeMode] = useState<"add" | "subtract">("add");
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState("new");
  const [completedDate, setCompletedDate] = useState("");
  const [error, setError] = useState("");
  const selected = products.find((p) => p.id === product);
  const selectedChannel = channels.find((c) => c.id === channel);
  const calc = useMemo(() => {
    const subtotal = unitPrice * qty;
    const merchandise = Math.max(subtotal - discount, 0);
    const bands = selectedChannel?.fee_bands ?? [];
    const band = resolveFeeBand(bands, merchandise);
    const feePercent = band ? band.fee_percent : selectedChannel?.fee_percent || 0;
    const fixedFee = band ? band.fixed_fee : selectedChannel?.fixed_fee || 0;
    const channelFee = merchandise * feePercent + fixedFee;
    const fee = channelFee + Math.max(campaignFee, 0);
    const netAfterFee = Math.max(merchandise - fee, 0);
    // "add": a taxa soma ao valor digitado para formar o total cobrado do cliente —
    // o alvo de recebimento é o valor cheio + taxa (ex.: taxa cobrada à parte do
    // cliente, incomum, mas possível em vendas diretas negociadas).
    // "subtract": o valor digitado já é o preço final do anúncio (Shopee/TikTok
    // Shop) — a taxa é descontada pelo marketplace ANTES de repassar o dinheiro, então
    // o alvo de recebimento (o que efetivamente cai na conta) é o valor líquido, não o
    // valor cheio. Sem isso, "A receber" nunca zeraria mesmo com o pagamento completo.
    const gross =
      feeMode === "add" ? merchandise + fee + shipping : Math.max(merchandise - fee, 0) + shipping;
    return { subtotal, merchandise, channelFee, fee, feePercent, fixedFee, band, netAfterFee, gross };
  }, [unitPrice, qty, discount, shipping, campaignFee, selectedChannel, feeMode]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (unitPrice <= 0) {
      setError("Informe o valor cobrado do cliente para este pedido.");
      return;
    }
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
        campaign_fee: Math.max(campaignFee, 0),
        fee_mode: feeMode,
        order_date: new Date(`${orderDate}T12:00:00`).toISOString(),
        status,
        completed_at: completedAt,
        items: [{ product_id: product, quantity: qty, unit_price: unitPrice }],
      }),
    });
    const j = await res.json();
    if (!res.ok) setError(j.error || "Erro");
    else r.push("/pedidos");
  }
  return (
    <form onSubmit={submit} className="card grid" style={{ maxWidth: 900 }}>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
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
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.fee_bands?.length
                  ? " — taxa por faixa de preço (automática)"
                  : ` — ${(Number(c.fee_percent) * 100).toFixed(2)}%${
                      Number(c.fixed_fee) > 0 ? ` + ${money(Number(c.fixed_fee))}` : ""
                    }`}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Produto</label>
          <select
            className="select"
            value={product}
            onChange={(e) => {
              const p = products.find((x) => x.id === e.target.value);
              setProduct(e.target.value);
              setPriceTouched(false);
              setUnitPrice(p?.sale_price ?? 0);
            }}
          >
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
          <label>Valor unitário cobrado do cliente</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              value={unitPrice}
              onChange={(e) => {
                setUnitPrice(Math.max(0, Number(e.target.value) || 0));
                setPriceTouched(true);
              }}
            />
            {priceTouched && Number(selected?.sale_price) !== unitPrice && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setUnitPrice(selected?.sale_price ?? 0);
                  setPriceTouched(false);
                }}
                title="Voltar para o preço cadastrado no produto"
              >
                Usar padrão
              </button>
            )}
          </div>
          <p className="muted">
            Vem preenchido com o preço do produto, mas edite livremente para usar o valor real
            do anúncio (Shopee, TikTok Shop, promoções etc.).
          </p>
          <div className="filters-row" style={{ marginTop: 8 }}>
            <span className="muted">A taxa do canal...</span>
            <button
              type="button"
              className={`btn btn-sm ${feeMode === "add" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setFeeMode("add")}
              title="O valor acima é líquido; a taxa soma por cima para o cliente"
            >
              Soma ao valor
            </button>
            <button
              type="button"
              className={`btn btn-sm ${feeMode === "subtract" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setFeeMode("subtract")}
              title="O valor acima já é o preço final (Shopee/TikTok); a taxa é descontada dele"
            >
              Desconta do valor
            </button>
          </div>
          <p className="muted">
            {feeMode === "add"
              ? "O cliente paga o valor acima + a taxa (soma no total do pedido)."
              : "O valor acima já é o que o cliente paga — a taxa sai da sua receita, sem aumentar o total do pedido."}
          </p>
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
          <label>Taxa de campanha/promoção (opcional)</label>
          <input
            className="input"
            type="number"
            step="0.01"
            min="0"
            value={campaignFee}
            onChange={(e) => setCampaignFee(Math.max(0, Number(e.target.value) || 0))}
          />
          <p className="muted">
            Valor extra que o marketplace descontou por participação em campanha/cupom neste
            pedido específico — some à taxa do canal só nesta venda.
          </p>
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
            Taxa do canal: <strong>{money(calc.channelFee)}</strong>
            {calc.band && (
              <span className="muted">
                {" "}
                (faixa {money(calc.band.min)}
                {calc.band.max !== null ? ` – ${money(calc.band.max)}` : "+"}:{" "}
                {(calc.feePercent * 100).toFixed(2)}% + {money(calc.fixedFee)})
              </span>
            )}
          </div>
          <div>
            Taxa de campanha: <strong>{money(campaignFee)}</strong>
          </div>
          <div>
            Frete: <strong>{money(shipping)}</strong>
          </div>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(2,1fr)", gap: 8, marginTop: 14 }}>
          <div>
            <div className="label">
              {feeMode === "add" ? "Venda bruta (o que o cliente paga)" : "Valor a receber (líquido)"}
            </div>
            <div className="value">{money(calc.gross)}</div>
          </div>
          <div>
            <div className="label">Receita líquida (após taxa, sem frete)</div>
            <div className="value">{money(calc.netAfterFee)}</div>
          </div>
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          {feeMode === "add"
            ? "Modo atual: a taxa soma ao valor digitado — o cliente paga esse total, e é isso que fica como \"a receber\" até você registrar o pagamento."
            : "Modo atual: o valor digitado é o preço do anúncio; a taxa já foi descontada pelo marketplace antes de cair na sua conta — é o valor líquido que fica como \"a receber\"."}{" "}
          Para canais com faixas de preço (ex.: Shopee), a taxa certa é escolhida automaticamente
          pelo valor da venda.
        </p>
      </div>
      <button className="btn btn-primary">Criar pedido</button>
    </form>
  );
}
