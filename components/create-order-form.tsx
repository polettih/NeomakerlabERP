"use client";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/format";
import { resolveFeeBand, type FeeBand } from "@/lib/fee-bands";

type ProdMaterialLink = { material_id: string; quantity: number; usage_type: "fdm" | "resin" | "other" };
type P = {
  id: string;
  name: string;
  sale_price: number;
  estimated_cost: number;
  category?: string;
  product_images?: { public_url: string; sort_order: number }[];
  product_materials?: ProdMaterialLink[];
};
type Mat = {
  id: string;
  name: string;
  material_type: string;
  color_name: string | null;
  average_cost: number;
  unit: string;
};
type C = { id: string; name: string };
type Ch = { id: string; name: string; fee_percent: number; fixed_fee: number; fee_bands: FeeBand[] };
type Line = {
  uid: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  priceTouched: boolean;
  overrides: Record<string, string>; // material_id original -> material_id escolhido
};
const uid = () => Math.random().toString(36).slice(2);

export function CreateOrderForm({
  customers,
  products,
  channels,
  materials,
}: {
  customers: C[];
  products: P[];
  channels: Ch[];
  materials: Mat[];
}) {
  const r = useRouter();
  const [customer, setCustomer] = useState("");
  const [channel, setChannel] = useState("");
  const [lines, setLines] = useState<Line[]>(() =>
    products[0]
      ? [
          {
            uid: uid(),
            product_id: products[0].id,
            quantity: 1,
            unit_price: products[0].sale_price,
            priceTouched: false,
            overrides: {},
          },
        ]
      : []
  );
  const [discount, setDiscount] = useState(0);
  const [shipping, setShipping] = useState(0);
  const [campaignFee, setCampaignFee] = useState(0);
  const [feeMode, setFeeMode] = useState<"add" | "subtract">("add");
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState("new");
  const [completedDate, setCompletedDate] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const selectedChannel = channels.find((c) => c.id === channel);

  function addLine() {
    const p = products[0];
    if (!p) return;
    setLines((x) => [
      ...x,
      { uid: uid(), product_id: p.id, quantity: 1, unit_price: p.sale_price, priceTouched: false, overrides: {} },
    ]);
  }
  function removeLine(id: string) {
    setLines((x) => x.filter((l) => l.uid !== id));
  }
  function updateLine(id: string, patch: Partial<Line>) {
    setLines((x) => x.map((l) => (l.uid === id ? { ...l, ...patch } : l)));
  }
  function setLineProduct(id: string, productId: string) {
    const p = products.find((x) => x.id === productId);
    updateLine(id, { product_id: productId, unit_price: p?.sale_price ?? 0, priceTouched: false, overrides: {} });
  }
  function setLineOverride(id: string, originalMaterialId: string, newMaterialId: string) {
    setLines((x) =>
      x.map((l) =>
        l.uid === id ? { ...l, overrides: { ...l.overrides, [originalMaterialId]: newMaterialId } } : l
      )
    );
  }

  const merchandise = useMemo(
    () => lines.reduce((s, l) => s + l.unit_price * l.quantity, 0),
    [lines]
  );
  const calc = useMemo(() => {
    const net = Math.max(merchandise - discount, 0);
    const bands = selectedChannel?.fee_bands ?? [];
    const band = resolveFeeBand(bands, net);
    const feePercent = band ? band.fee_percent : selectedChannel?.fee_percent || 0;
    const fixedFee = band ? band.fixed_fee : selectedChannel?.fixed_fee || 0;
    const channelFee = net * feePercent + fixedFee;
    const fee = channelFee + Math.max(campaignFee, 0);
    const netAfterFee = Math.max(net - fee, 0);
    const gross = feeMode === "add" ? net + fee + shipping : Math.max(net - fee, 0) + shipping;
    return { net, channelFee, fee, feePercent, fixedFee, band, netAfterFee, gross };
  }, [merchandise, discount, shipping, campaignFee, selectedChannel, feeMode]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!lines.length) return setError("Adicione pelo menos um produto.");
    if (lines.some((l) => !l.product_id || l.quantity <= 0 || l.unit_price <= 0))
      return setError("Confira produto, quantidade e valor de cada item do pedido.");
    if (status === "delivered" && !completedDate) {
      setError("Informe a data de conclusão do pedido.");
      return;
    }
    setBusy(true);
    const completedAt = completedDate ? new Date(`${completedDate}T12:00:00`).toISOString() : null;
    const items = lines.map((l) => {
      const p = products.find((x) => x.id === l.product_id);
      const linkedMaterials = (p?.product_materials ?? []).map((m) => ({
        material_id: l.overrides[m.material_id] ?? m.material_id,
        quantity: m.quantity,
        usage_type: m.usage_type,
      }));
      return {
        product_id: l.product_id,
        quantity: l.quantity,
        unit_price: l.unit_price,
        materials: linkedMaterials,
      };
    });
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
        items,
      }),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) setError(j.error || "Erro");
    else r.push("/pedidos");
  }

  return (
    <form onSubmit={submit} className="card grid" style={{ gap: 18 }}>
      {error && <div className="error">{error}</div>}
      <div className="form-grid">
        <div className="field">
          <label>Cliente</label>
          <select className="select" value={customer} onChange={(e) => setCustomer(e.target.value)}>
            <option value="">Sem cliente cadastrado</option>
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
            <option value="">Venda direta (sem taxa)</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.fee_bands?.length
                  ? " — taxa por faixa de preço"
                  : ` — ${(Number(c.fee_percent) * 100).toFixed(2)}%${
                      Number(c.fixed_fee) > 0 ? ` + ${money(Number(c.fixed_fee))}` : ""
                    }`}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Data do pedido</label>
          <input
            className="input"
            type="date"
            value={orderDate}
            onChange={(e) => setOrderDate(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Status</label>
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="new">Novo</option>
            <option value="preparation">Em preparação</option>
            <option value="production">Em produção</option>
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
              required
            />
          </div>
        )}
      </div>

      <div className="section-title">
        <h3>🧾 Itens do pedido</h3>
        <button type="button" className="btn btn-secondary btn-sm" onClick={addLine}>
          + Adicionar item (kit)
        </button>
      </div>
      {lines.map((l) => {
        const p = products.find((x) => x.id === l.product_id);
        const thumb = [...(p?.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0];
        return (
          <div key={l.uid} className="card" style={{ background: "#0f1318" }}>
            <div className="form-grid">
              <div className="field">
                <label>Produto</label>
                <select
                  className="select"
                  value={l.product_id}
                  onChange={(e) => setLineProduct(l.uid, e.target.value)}
                >
                  {products.map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      {prod.name} — {money(Number(prod.sale_price))}
                    </option>
                  ))}
                </select>
                {thumb && (
                  <div className="product-preview">
                    <img className="product-thumb" src={thumb.public_url} alt="" />
                    <div className="muted">{p?.category || "Bonecos"}</div>
                  </div>
                )}
              </div>
              <div className="field">
                <label>Quantidade</label>
                <input
                  className="input"
                  type="number"
                  min="1"
                  value={l.quantity}
                  onChange={(e) => updateLine(l.uid, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                />
              </div>
              <div className="field">
                <label>Valor unitário cobrado do cliente</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    min="0"
                    value={l.unit_price}
                    onChange={(e) =>
                      updateLine(l.uid, { unit_price: Math.max(0, Number(e.target.value) || 0), priceTouched: true })
                    }
                  />
                  {l.priceTouched && Number(p?.sale_price) !== l.unit_price && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => updateLine(l.uid, { unit_price: p?.sale_price ?? 0, priceTouched: false })}
                      title="Voltar para o preço cadastrado no produto"
                    >
                      Padrão
                    </button>
                  )}
                </div>
              </div>
              {lines.length > 1 && (
                <div className="field" style={{ justifyContent: "flex-end" }}>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => removeLine(l.uid)}>
                    Remover item
                  </button>
                </div>
              )}
            </div>
            {!!p?.product_materials?.length && (
              <div style={{ marginTop: 8 }}>
                <p className="muted" style={{ marginBottom: 6 }}>
                  Mesmo produto, cor diferente? Troque o material só nesta venda:
                </p>
                {p.product_materials.map((m) => {
                  const original = materials.find((x) => x.id === m.material_id);
                  const chosenId = l.overrides[m.material_id] ?? m.material_id;
                  const options = materials.filter((x) => x.material_type === original?.material_type);
                  return (
                    <div key={m.material_id} className="filters-row" style={{ marginBottom: 6 }}>
                      <span className="muted">
                        {m.usage_type === "fdm" ? "Filamento" : m.usage_type === "resin" ? "Resina" : "Insumo"}:
                      </span>
                      <select
                        className="select"
                        style={{ maxWidth: 320 }}
                        value={chosenId}
                        onChange={(e) => setLineOverride(l.uid, m.material_id, e.target.value)}
                      >
                        {options.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                            {o.color_name ? ` — ${o.color_name}` : ""}
                            {o.id === m.material_id ? " (padrão do produto)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <div className="form-grid">
        <div className="field">
          <label>Desconto no total</label>
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
            pedido específico.
          </p>
        </div>
        <div className="field">
          <label>A taxa do canal...</label>
          <div className="filters-row">
            <button
              type="button"
              className={`btn btn-sm ${feeMode === "add" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setFeeMode("add")}
              title="O valor digitado é líquido; a taxa soma por cima para o cliente"
            >
              Soma ao valor
            </button>
            <button
              type="button"
              className={`btn btn-sm ${feeMode === "subtract" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setFeeMode("subtract")}
              title="O valor digitado já é o preço final (Shopee/TikTok); a taxa é descontada dele"
            >
              Desconta do valor
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div>
          Itens: <strong>{money(merchandise)}</strong>
        </div>
        <div>
          Desconto: <strong>-{money(discount)}</strong>
        </div>
        <div>
          Taxa do canal: <strong>{money(calc.channelFee)}</strong>
          {calc.band && (
            <span className="muted">
              {" "}
              (faixa {money(calc.band.min)}
              {calc.band.max !== null ? ` – ${money(calc.band.max)}` : "+"}: {(calc.feePercent * 100).toFixed(2)}% +{" "}
              {money(calc.fixedFee)})
            </span>
          )}
        </div>
        <div>
          Taxa de campanha: <strong>{money(campaignFee)}</strong>
        </div>
        <div>
          Frete: <strong>{money(shipping)}</strong>
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
            : "Modo atual: o valor digitado é o preço do anúncio; a taxa já foi descontada pelo marketplace antes de cair na sua conta — é o valor líquido que fica como \"a receber\"."}
        </p>
      </div>

      <div className="actions" style={{ justifyContent: "flex-end" }}>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Salvando..." : "Criar pedido"}
        </button>
      </div>
    </form>
  );
}
