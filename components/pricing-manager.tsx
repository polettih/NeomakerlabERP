"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function PricingManager({
  products,
  materials,
  initialPricing,
  initialLinks,
  laborHourRate,
}: {
  products: any[];
  materials: any[];
  initialPricing: any[];
  initialLinks: any[];
  laborHourRate: number;
}) {
  const r = useRouter();
  const [productId, setProductId] = useState(products[0]?.id || "");
  const [pricing, setPricing] = useState<any>({});
  const [links, setLinks] = useState<any[]>([]);
  const [form, setForm] = useState({ material_id: materials[0]?.id || "", quantity: "1" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const p = initialPricing.find((x) => x.product_id === productId);
    setPricing(
      p
        ? { ...p, labor_hour: laborHourRate }
        : {
            filament_hours: 0,
            resin_hours: 0,
            painting_hours: 0,
            finishing_hours: 0,
            labor_hour: laborHourRate,
            energy_cost_kwh: 1.12,
            filament_power_kw: 0.12,
            resin_power_kw: 0.07,
            filament_depr_hour: 0,
            resin_depr_hour: 0,
            painting_materials: 0,
            packaging_cost: 0,
            other_cost: 0,
            loss_percent: 0.08,
            margin_percent: 0.2,
            marketplace_commission: 0.14,
          }
    );
    setLinks(initialLinks.filter((x) => x.product_id === productId));
    setForm({ material_id: materials[0]?.id || "", quantity: "1" });
  }, [productId, initialPricing, initialLinks, materials, laborHourRate]);
  const materialCost = useMemo(
    () => links.reduce((s, l) => s + Number(l.quantity) * Number(l.material?.average_cost || 0), 0),
    [links]
  );
  const waste = materialCost * Number(pricing.loss_percent || 0);
  const energy =
    Number(pricing.filament_hours || 0) *
      Number(pricing.filament_power_kw || 0) *
      Number(pricing.energy_cost_kwh || 0) +
    Number(pricing.resin_hours || 0) *
      Number(pricing.resin_power_kw || 0) *
      Number(pricing.energy_cost_kwh || 0);
  const depreciation =
    Number(pricing.filament_hours || 0) * Number(pricing.filament_depr_hour || 0) +
    Number(pricing.resin_hours || 0) * Number(pricing.resin_depr_hour || 0);
  const labor =
    (Number(pricing.painting_hours || 0) + Number(pricing.finishing_hours || 0)) *
    Number(pricing.labor_hour || 0);
  const total =
    materialCost +
    waste +
    energy +
    depreciation +
    labor +
    Number(pricing.painting_materials || 0) +
    Number(pricing.packaging_cost || 0) +
    Number(pricing.other_cost || 0);
  const suggested = total * (1 + Number(pricing.margin_percent || 0));
  const commission = suggested * Number(pricing.marketplace_commission || 0);
  const net = suggested - commission;
  const profit = net - total;
  async function save() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/product-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: productId,
          ...pricing,
          material_cost: materialCost,
          energy_cost: energy,
          depreciation_cost: depreciation,
          labor_cost: labor,
          waste_cost: waste,
          total_cost: total,
          suggested_price: suggested,
          net_after_commission: net,
          profit,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Erro");
      r.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function addMaterial(e: any) {
    e.preventDefault();
    try {
      const res = await fetch("/api/product-materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: productId,
          material_id: form.material_id,
          quantity: Number(form.quantity),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Erro");
      const m = materials.find((x) => x.id === form.material_id);
      setLinks((prev) => [
        ...prev.filter((x) => x.material_id !== form.material_id),
        {
          id: j.id,
          product_id: productId,
          material_id: form.material_id,
          quantity: Number(form.quantity),
          material: m,
        } as any,
      ]);
      r.refresh();
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function removeMaterial(id: string) {
    await fetch("/api/product-materials", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setLinks((prev) => prev.filter((x) => x.id !== id));
    r.refresh();
  }
  const set = (k: string, v: string) => setPricing((p: any) => ({ ...p, [k]: Number(v) }));
  const selected = products.find((p) => p.id === productId);
  return (
    <div className="grid">
      {error && <div className="error">{error}</div>}
      <div className="card">
        <div className="form-grid">
          <div className="field">
            <label>Produto</label>
            <select
              className="select"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Preço atual</label>
            <div className="input">{money(Number(selected?.sale_price || 0))}</div>
          </div>
        </div>
      </div>
      <div className="two-col grid">
        <div className="card grid">
          <h2>Materiais consumidos</h2>
          <form className="form-grid" onSubmit={addMaterial}>
            <div className="field">
              <label>Material</label>
              <select
                className="select"
                value={form.material_id}
                onChange={(e) => setForm({ ...form, material_id: e.target.value })}
              >
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.category}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Quantidade por unidade</label>
              <input
                className="input"
                type="number"
                step="0.001"
                min="0.001"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </div>
            <button className="btn btn-secondary">Adicionar material</button>
          </form>
          <table>
            <thead>
              <tr>
                <th>Material</th>
                <th>Qtd.</th>
                <th>Custo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {links.map((l) => (
                <tr key={l.id}>
                  <td>{l.material?.name || materials.find((m) => m.id === l.material_id)?.name}</td>
                  <td>{Number(l.quantity).toFixed(3)}</td>
                  <td>{money(Number(l.quantity) * Number(l.material?.average_cost || 0))}</td>
                  <td>
                    <button className="btn btn-danger btn-sm" onClick={() => removeMaterial(l.id)}>
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card grid">
          <h2>Tempo e custos</h2>
          <div className="form-grid">
            <div className="field">
              <label>Horas FDM</label>
              <input
                className="input"
                type="number"
                step="0.01"
                value={pricing.filament_hours || 0}
                onChange={(e) => set("filament_hours", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Horas resina</label>
              <input
                className="input"
                type="number"
                step="0.01"
                value={pricing.resin_hours || 0}
                onChange={(e) => set("resin_hours", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Horas pintura</label>
              <input
                className="input"
                type="number"
                step="0.01"
                value={pricing.painting_hours || 0}
                onChange={(e) => set("painting_hours", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Horas acabamento</label>
              <input
                className="input"
                type="number"
                step="0.01"
                value={pricing.finishing_hours || 0}
                onChange={(e) => set("finishing_hours", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Valor cobrado por hora</label>
              <div className="input">{money(Number(laborHourRate || 0))}</div>
              <small className="muted">Definido na aba Financeiro → Mão de obra.</small>
            </div>
            <div className="field">
              <label>Energia (R$/kWh)</label>
              <input
                className="input"
                type="number"
                step="0.01"
                value={pricing.energy_cost_kwh || 0}
                onChange={(e) => set("energy_cost_kwh", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Potência FDM (kW)</label>
              <input
                className="input"
                type="number"
                step="0.001"
                value={pricing.filament_power_kw || 0}
                onChange={(e) => set("filament_power_kw", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Potência resina (kW)</label>
              <input
                className="input"
                type="number"
                step="0.001"
                value={pricing.resin_power_kw || 0}
                onChange={(e) => set("resin_power_kw", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Depreciação FDM/h</label>
              <input
                className="input"
                type="number"
                step="0.0001"
                value={pricing.filament_depr_hour || 0}
                onChange={(e) => set("filament_depr_hour", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Depreciação resina/h</label>
              <input
                className="input"
                type="number"
                step="0.0001"
                value={pricing.resin_depr_hour || 0}
                onChange={(e) => set("resin_depr_hour", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Materiais de pintura</label>
              <input
                className="input"
                type="number"
                step="0.01"
                value={pricing.painting_materials || 0}
                onChange={(e) => set("painting_materials", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Embalagem</label>
              <input
                className="input"
                type="number"
                step="0.01"
                value={pricing.packaging_cost || 0}
                onChange={(e) => set("packaging_cost", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Outros custos</label>
              <input
                className="input"
                type="number"
                step="0.01"
                value={pricing.other_cost || 0}
                onChange={(e) => set("other_cost", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Perda (%)</label>
              <input
                className="input"
                type="number"
                step="0.01"
                value={Number(pricing.loss_percent || 0) * 100}
                onChange={(e) => set("loss_percent", String(Number(e.target.value) / 100))}
              />
            </div>
            <div className="field">
              <label>Margem (%)</label>
              <input
                className="input"
                type="number"
                step="0.01"
                value={Number(pricing.margin_percent || 0) * 100}
                onChange={(e) => set("margin_percent", String(Number(e.target.value) / 100))}
              />
            </div>
            <div className="field">
              <label>Comissão (%)</label>
              <input
                className="input"
                type="number"
                step="0.01"
                value={Number(pricing.marketplace_commission || 0) * 100}
                onChange={(e) =>
                  set("marketplace_commission", String(Number(e.target.value) / 100))
                }
              />
            </div>
          </div>
        </div>
      </div>
      <div className="card">
        <h2>Resumo da precificação</h2>
        <div className="form-grid">
          <p>
            Materiais <b>{money(materialCost)}</b>
          </p>
          <p>
            Perdas <b>{money(waste)}</b>
          </p>
          <p>
            Energia <b>{money(energy)}</b>
          </p>
          <p>
            Depreciação <b>{money(depreciation)}</b>
          </p>
          <p>
            Mão de obra <b>{money(labor)}</b>
          </p>
          <p>
            Outros{" "}
            <b>
              {money(
                Number(pricing.painting_materials || 0) +
                  Number(pricing.packaging_cost || 0) +
                  Number(pricing.other_cost || 0)
              )}
            </b>
          </p>
        </div>
        <hr />
        <div className="form-grid">
          <p>
            <strong>Custo total</strong>
            <br />
            <span className="value">{money(total)}</span>
          </p>
          <p>
            <strong>Preço sugerido</strong>
            <br />
            <span className="value">{money(suggested)}</span>
          </p>
          <p>
            <strong>Comissão</strong>
            <br />
            {money(commission)}
          </p>
          <p>
            <strong>Lucro líquido</strong>
            <br />
            <span className="value">{money(profit)}</span>
          </p>
        </div>
        <button className="btn btn-primary" disabled={busy} onClick={save}>
          {busy ? "Salvando..." : "Salvar precificação e atualizar produto"}
        </button>
      </div>
    </div>
  );
}
