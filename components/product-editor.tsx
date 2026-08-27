"use client";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
const cats = ["Bonecos", "Objetos", "Miniaturas", "Decoração", "Outros"];
const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const weight = (u: string) => ["kg", "g", "grama", "gramas"].includes((u || "").toLowerCase());
const costOf = (m: any, q: number) => {
  if (!m) return 0;
  return (m.unit || "").toLowerCase() === "kg"
    ? (q / 1000) * Number(m.average_cost || 0)
    : q * Number(m.average_cost || 0);
};
type Img = { id: string; public_url: string; storage_path: string; sort_order: number };
type Product = {
  id: string;
  name: string;
  sale_price: number;
  estimated_cost: number;
  category: string;
  images: Img[];
};
type Material = {
  id: string;
  name: string;
  category: string;
  unit: string;
  average_cost: number;
  material_type?: string;
  color_name?: string;
  color_hex?: string;
};
type Machine = {
  id: string;
  name: string;
  category: string;
  power_kw: number;
  depreciation_per_hour: number;
  active: boolean;
};
export function ProductEditor({
  product,
  materials,
  machines,
  laborHourRate,
  energyCostKwh,
}: {
  product: Product;
  materials: Material[];
  machines: Machine[];
  laborHourRate: number;
  energyCostKwh: number;
}) {
  const r = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const [name, setName] = useState(product.name),
    [category, setCategory] = useState(product.category || "Bonecos"),
    [price, setPrice] = useState(String(product.sale_price)),
    [images, setImages] = useState(product.images || []);
  const [fdmEnabled, setFdmEnabled] = useState(false),
    [resinEnabled, setResinEnabled] = useState(false),
    [fdmMachineId, setFdmMachineId] = useState(""),
    [resinMachineId, setResinMachineId] = useState(""),
    [fdmHours, setFdmHours] = useState("0"),
    [resinHours, setResinHours] = useState("0"),
    [fdmMaterialId, setFdmMaterialId] = useState(""),
    [resinMaterialId, setResinMaterialId] = useState(""),
    [fdmQty, setFdmQty] = useState("0"),
    [resinQty, setResinQty] = useState("0"),
    [extraLinks, setExtraLinks] = useState<any[]>([]),
    [paintingHours, setPaintingHours] = useState("0"),
    [finishingHours, setFinishingHours] = useState("0"),
    [paintingMaterials, setPaintingMaterials] = useState("0"),
    [packagingCost, setPackagingCost] = useState("0"),
    [otherCost, setOtherCost] = useState("0"),
    [lossPercent, setLossPercent] = useState("8"),
    [marginPercent, setMarginPercent] = useState("20");
  const fdmMachines = machines.filter((m) => m.category === "Impressora FDM" && m.active),
    resinMachines = machines.filter((m) => m.category === "Impressora Resina" && m.active);
  const fdmMaterials = materials.filter((m) => m.material_type === "Filamento");
  const resinMaterials = materials.filter((m) => m.material_type === "Resina");
  const fdmMaterial = materials.find((m) => m.id === fdmMaterialId),
    resinMaterial = materials.find((m) => m.id === resinMaterialId),
    fdmMachine = fdmMachines.find((m) => m.id === fdmMachineId),
    resinMachine = resinMachines.find((m) => m.id === resinMachineId);
  const fdmCost = fdmEnabled ? costOf(fdmMaterial, Number(fdmQty || 0)) : 0,
    resinCost = resinEnabled ? costOf(resinMaterial, Number(resinQty || 0)) : 0,
    extraCost = extraLinks
      .filter((x) => x.usage_type === "other")
      .reduce(
        (s, x) =>
          s +
          costOf(
            materials.find((m) => m.id === x.material_id),
            Number((x.displayQty ?? x.quantity) || 0)
          ),
        0
      ),
    materialCost = fdmCost + resinCost + extraCost,
    waste = (materialCost * Number(lossPercent || 0)) / 100,
    energyCost =
      ((fdmEnabled ? Number(fdmHours) * Number(fdmMachine?.power_kw || 0) : 0) +
        (resinEnabled ? Number(resinHours) * Number(resinMachine?.power_kw || 0) : 0)) *
      energyCostKwh,
    depreciation =
      (fdmEnabled ? Number(fdmHours) * Number(fdmMachine?.depreciation_per_hour || 0) : 0) +
      (resinEnabled ? Number(resinHours) * Number(resinMachine?.depreciation_per_hour || 0) : 0),
    labor = (Number(paintingHours) + Number(finishingHours)) * laborHourRate,
    extras = Number(paintingMaterials) + Number(packagingCost) + Number(otherCost),
    total = materialCost + waste + energyCost + depreciation + labor + extras,
    suggested = total * (1 + Number(marginPercent || 0) / 100),
    profit = suggested - total;
  async function openEditor() {
    setOpen(true);
    setLoading(true);
    setError("");
    try {
      const [pr, pm] = await Promise.all([
        fetch(`/api/product-pricing?product_id=${product.id}`),
        fetch(`/api/product-materials?product_id=${product.id}`),
      ]);
      const pricing = await pr.json(),
        links = await pm.json();
      if (!pr.ok) throw new Error(pricing.error);
      if (!pm.ok) throw new Error(links.error);
      const f = links.find((x: any) => x.usage_type === "fdm"),
        res = links.find((x: any) => x.usage_type === "resin");
      setFdmEnabled(!!f || !!pricing?.fdm_machine_id);
      setResinEnabled(!!res || !!pricing?.resin_machine_id);
      setFdmMachineId(pricing?.fdm_machine_id || "");
      setResinMachineId(pricing?.resin_machine_id || "");
      setFdmMaterialId(pricing?.fdm_material_id || f?.material_id || "");
      setResinMaterialId(pricing?.resin_material_id || res?.material_id || "");
      setFdmHours(String(pricing?.filament_hours ?? 0));
      setResinHours(String(pricing?.resin_hours ?? 0));
      const toDisplay = (x: any) => {
        const m = materials.find((a: any) => a.id === x.material_id);
        return m?.unit?.toLowerCase() === "kg" ? Number(x.quantity) * 1000 : Number(x.quantity);
      };
      setFdmQty(String(f ? toDisplay(f) : 0));
      setResinQty(String(res ? toDisplay(res) : 0));
      setExtraLinks(
        links
          .filter((x: any) => !["fdm", "resin"].includes(x.usage_type))
          .map((x: any) => ({ ...x, displayQty: toDisplay(x) }))
      );
      setPaintingHours(String(pricing?.painting_hours ?? 0));
      setFinishingHours(String(pricing?.finishing_hours ?? 0));
      setPaintingMaterials(String(pricing?.painting_materials ?? 0));
      setPackagingCost(String(pricing?.packaging_cost ?? 0));
      setOtherCost(String(pricing?.other_cost ?? 0));
      setLossPercent(String(Number(pricing?.loss_percent ?? 0) * 100));
      setMarginPercent(String(Number(pricing?.margin_percent ?? 0) * 100));
      setPrice(String(product.sale_price));
    } catch (e: any) {
      setError(e.message || "Erro ao carregar produto.");
    } finally {
      setLoading(false);
    }
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      if (!fdmEnabled && !resinEnabled) throw new Error("Selecione FDM, resina ou ambos.");
      if (
        fdmEnabled &&
        (!fdmMachineId || !fdmMaterialId || Number(fdmHours) <= 0 || Number(fdmQty) <= 0)
      )
        throw new Error("Preencha máquina, horas e material da FDM.");
      if (
        resinEnabled &&
        (!resinMachineId || !resinMaterialId || Number(resinHours) <= 0 || Number(resinQty) <= 0)
      )
        throw new Error("Preencha impressora, horas e resina.");
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, sale_price: suggested, estimated_cost: total, category }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      const del = await fetch("/api/product-materials/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: product.id }),
      });
      if (!del.ok) throw new Error("Não foi possível atualizar os materiais do produto.");
      const links: any[] = [];
      if (fdmEnabled)
        links.push({
          material_id: fdmMaterialId,
          quantity: Number(fdmQty) / ((fdmMaterial?.unit || "").toLowerCase() === "kg" ? 1000 : 1),
          usage_type: "fdm",
        });
      if (resinEnabled)
        links.push({
          material_id: resinMaterialId,
          quantity:
            Number(resinQty) / ((resinMaterial?.unit || "").toLowerCase() === "kg" ? 1000 : 1),
          usage_type: "resin",
        });
      for (const x of extraLinks) {
        const m = materials.find((a) => a.id === x.material_id);
        links.push({
          material_id: x.material_id,
          quantity:
            Number((x.displayQty ?? x.quantity) || 0) /
            ((m?.unit || "").toLowerCase() === "kg" ? 1000 : 1),
          usage_type: "other",
        });
      }
      for (const x of links) {
        const rr = await fetch("/api/product-materials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product_id: product.id, ...x }),
        });
        if (!rr.ok) throw new Error((await rr.json()).error || "Erro ao salvar material.");
      }
      const pricing = {
        product_id: product.id,
        fdm_machine_id: fdmEnabled ? fdmMachineId : null,
        resin_machine_id: resinEnabled ? resinMachineId : null,
        fdm_material_id: fdmEnabled ? fdmMaterialId : null,
        resin_material_id: resinEnabled ? resinMaterialId : null,
        filament_hours: fdmEnabled ? Number(fdmHours) : 0,
        resin_hours: resinEnabled ? Number(resinHours) : 0,
        painting_hours: Number(paintingHours),
        finishing_hours: Number(finishingHours),
        painting_materials: Number(paintingMaterials),
        packaging_cost: Number(packagingCost),
        other_cost: Number(otherCost),
        energy_cost_kwh: energyCostKwh,
        filament_power_kw: fdmEnabled ? Number(fdmMachine?.power_kw || 0) : 0,
        resin_power_kw: resinEnabled ? Number(resinMachine?.power_kw || 0) : 0,
        filament_depr_hour: fdmEnabled ? Number(fdmMachine?.depreciation_per_hour || 0) : 0,
        resin_depr_hour: resinEnabled ? Number(resinMachine?.depreciation_per_hour || 0) : 0,
        loss_percent: Number(lossPercent) / 100,
        margin_percent: Number(marginPercent) / 100,
        marketplace_commission: 0,
        material_cost: materialCost,
        energy_cost: energyCost,
        depreciation_cost: depreciation,
        labor_cost: labor,
        waste_cost: waste,
        total_cost: total,
        suggested_price: suggested,
        net_after_commission: suggested,
        profit,
      };
      const pp = await fetch("/api/product-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pricing),
      });
      if (!pp.ok) throw new Error((await pp.json()).error || "Erro ao salvar precificação.");
      setOpen(false);
      r.refresh();
    } catch (e: any) {
      setError(e.message || "Erro");
    } finally {
      setBusy(false);
    }
  }
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    if (images.length + files.length > 8) {
      setError("Máximo de 8 fotos.");
      return;
    }
    setBusy(true);
    try {
      const sb = createClient();
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) throw new Error("Sessão expirada.");
      const paths = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i],
          ext = f.name.split(".").pop()?.toLowerCase() || "jpg",
          path = `${user.id}/${product.id}/${crypto.randomUUID()}.${ext}`;
        const up = await sb.storage
          .from("product-images")
          .upload(path, f, { upsert: false, contentType: f.type });
        if (up.error) throw up.error;
        const { data: url } = sb.storage.from("product-images").getPublicUrl(path);
        paths.push({
          product_id: product.id,
          storage_path: path,
          public_url: url.publicUrl,
          sort_order: images.length + i,
        });
      }
      const ins = await sb
        .from("product_images")
        .insert(paths)
        .select("id,public_url,storage_path,sort_order");
      if (ins.error) throw ins.error;
      setImages([...images, ...(ins.data as Img[])]);
    } catch (e: any) {
      setError(e.message || "Erro");
    } finally {
      setBusy(false);
    }
  }
  async function remove(img: Img) {
    if (!confirm("Remover esta foto?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/product-images/${img.id}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Erro");
      setImages(images.filter((x) => x.id !== img.id));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button className="btn btn-secondary btn-sm" onClick={openEditor}>
        Editar
      </button>
      {open && (
        <div className="modal-backdrop">
          <div className="modal card">
            <div className="section-title">
              <div>
                <h2>Editar produto</h2>
                <p className="muted">
                  Alterações valem para novas produções e novos pedidos. Pedidos já lançados mantêm
                  o custo/preço histórico.
                </p>
              </div>
              <button className="btn btn-secondary" onClick={() => setOpen(false)}>
                Fechar
              </button>
            </div>
            {error && <div className="error">{error}</div>}
            {loading ? (
              <p>Carregando configuração...</p>
            ) : (
              <>
                <div className="form-grid">
                  <Field label="Nome">
                    <input
                      className="input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </Field>
                  <Field label="Categoria">
                    <select
                      className="select"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      {cats.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Preço atual sugerido">
                    <div className="input">{money(suggested)}</div>
                  </Field>
                </div>
                <div className="section-title">
                  <h3>🖨️ FDM</h3>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={fdmEnabled}
                      onChange={(e) => setFdmEnabled(e.target.checked)}
                    />{" "}
                    Usar FDM
                  </label>
                </div>
                {fdmEnabled && (
                  <div className="form-grid">
                    <Field label="Máquina">
                      <select
                        className="select"
                        value={fdmMachineId}
                        onChange={(e) => setFdmMachineId(e.target.value)}
                      >
                        <option value="">Selecione</option>
                        {fdmMachines.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Horas">
                      <input
                        className="input"
                        type="number"
                        step="0.01"
                        min="0"
                        value={fdmHours}
                        onChange={(e) => setFdmHours(e.target.value)}
                      />
                    </Field>
                    <Field label="Material">
                      <select
                        className="select"
                        value={fdmMaterialId}
                        onChange={(e) => setFdmMaterialId(e.target.value)}
                      >
                        <option value="">Selecione</option>
                        {fdmMaterials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} {m.color_name ? `— ${m.color_name}` : ""} —{" "}
                            {money(Number(m.average_cost))}/{m.unit}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={"Quantidade (g)"}>
                      <input
                        className="input"
                        type="number"
                        step="0.001"
                        min="0"
                        value={fdmQty}
                        onChange={(e) => setFdmQty(e.target.value)}
                      />
                    </Field>
                  </div>
                )}
                {
                  <div className="section-title">
                    <h3>🧪 Resina</h3>
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={resinEnabled}
                        onChange={(e) => setResinEnabled(e.target.checked)}
                      />{" "}
                      Usar resina
                    </label>
                  </div>
                }
                {resinEnabled && (
                  <div className="form-grid">
                    <Field label="Impressora">
                      <select
                        className="select"
                        value={resinMachineId}
                        onChange={(e) => setResinMachineId(e.target.value)}
                      >
                        <option value="">Selecione</option>
                        {resinMachines.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Horas">
                      <input
                        className="input"
                        type="number"
                        step="0.01"
                        min="0"
                        value={resinHours}
                        onChange={(e) => setResinHours(e.target.value)}
                      />
                    </Field>
                    <Field label="Resina">
                      <select
                        className="select"
                        value={resinMaterialId}
                        onChange={(e) => setResinMaterialId(e.target.value)}
                      >
                        <option value="">Selecione</option>
                        {resinMaterials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} {m.color_name ? `— ${m.color_name}` : ""} —{" "}
                            {money(Number(m.average_cost))}/{m.unit}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={"Quantidade (ml)"}>
                      <input
                        className="input"
                        type="number"
                        step="0.001"
                        min="0"
                        value={resinQty}
                        onChange={(e) => setResinQty(e.target.value)}
                      />
                    </Field>
                  </div>
                )}
                <div className="section-title">
                  <h3>🎨 Pintura e acabamento</h3>
                </div>
                <div className="form-grid">
                  <Field label="Horas de pintura">
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      min="0"
                      value={paintingHours}
                      onChange={(e) => setPaintingHours(e.target.value)}
                    />
                  </Field>
                  <Field label="Horas de acabamento">
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      min="0"
                      value={finishingHours}
                      onChange={(e) => setFinishingHours(e.target.value)}
                    />
                  </Field>
                  <Field label="Valor/hora">
                    <div className="input">{money(laborHourRate)}</div>
                  </Field>
                  <Field label="Materiais de pintura">
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      min="0"
                      value={paintingMaterials}
                      onChange={(e) => setPaintingMaterials(e.target.value)}
                    />
                  </Field>
                  <Field label="Embalagem">
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      min="0"
                      value={packagingCost}
                      onChange={(e) => setPackagingCost(e.target.value)}
                    />
                  </Field>
                  <Field label="Outros custos">
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      min="0"
                      value={otherCost}
                      onChange={(e) => setOtherCost(e.target.value)}
                    />
                  </Field>
                  <Field label="Perda/refugo (%)">
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      min="0"
                      value={lossPercent}
                      onChange={(e) => setLossPercent(e.target.value)}
                    />
                  </Field>
                  <Field label="Margem desejada (%)">
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      min="0"
                      value={marginPercent}
                      onChange={(e) => setMarginPercent(e.target.value)}
                    />
                  </Field>
                </div>
                <div className="card">
                  <h3>🧮 Resumo</h3>
                  <div className="form-grid">
                    <p>
                      Materiais
                      <br />
                      <b>{money(materialCost)}</b>
                    </p>
                    <p>
                      Perdas
                      <br />
                      <b>{money(waste)}</b>
                    </p>
                    <p>
                      Energia
                      <br />
                      <b>{money(energyCost)}</b>
                    </p>
                    <p>
                      Depreciação
                      <br />
                      <b>{money(depreciation)}</b>
                    </p>
                    <p>
                      Mão de obra
                      <br />
                      <b>{money(labor)}</b>
                    </p>
                    <p>
                      Outros
                      <br />
                      <b>{money(extras)}</b>
                    </p>
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
                      <strong>Lucro líquido estimado</strong>
                      <br />
                      <span className="value">{money(profit)}</span>
                    </p>
                  </div>
                </div>
                <div className="section-title">
                  <div>
                    <h3>📸 Fotos ({images.length}/8)</h3>
                    <p className="muted">A primeira foto continua sendo a principal.</p>
                  </div>
                  <button
                    className="btn btn-secondary"
                    disabled={busy || images.length >= 8}
                    onClick={() => ref.current?.click()}
                  >
                    Adicionar fotos
                  </button>
                  <input
                    ref={ref}
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={(e) => upload(e.target.files)}
                  />
                </div>
                <div className="photo-grid">
                  {images.map((img, i) => (
                    <div className="photo-item" key={img.id}>
                      <img src={img.public_url} alt="" />
                      <div className="photo-caption">
                        <span className="badge">{i === 0 ? "Principal" : `#${i + 1}`}</span>
                        <button className="btn btn-danger btn-sm" onClick={() => remove(img)}>
                          Remover
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="actions" style={{ justifyContent: "flex-end", marginTop: 18 }}>
                  <button className="btn btn-secondary" onClick={() => setOpen(false)}>
                    Cancelar
                  </button>
                  <button className="btn btn-primary" disabled={busy} onClick={save}>
                    {busy ? "Salvando..." : "Salvar alterações"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}
