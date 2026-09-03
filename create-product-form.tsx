"use client";
import { FormEvent, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/format";
import { errorMessage } from "@/lib/errors";
import { HoursMinutesInput } from "@/components/hours-minutes-input";

const cats = ["Bonecos", "Objetos", "Miniaturas", "Decoração", "Outros"];
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
  category: "Impressora FDM" | "Impressora Resina";
  power_kw: number;
  purchase_value: number;
  useful_hours: number;
  depreciation_per_hour: number;
  active: boolean;
};
type Props = {
  materials: Material[];
  machines: Machine[];
  laborHourRate: number;
  energyCostKwh: number;
};
type Link = { material_id: string; quantity: number; usage_type: "fdm" | "resin" | "other" };
const isWeight = (u: string) => ["kg", "g", "grama", "gramas"].includes(u.toLowerCase());
const costOf = (m: Material | undefined, q: number) => {
  if (!m) return 0;
  const u = m.unit.toLowerCase();
  if (u === "kg") return (q / 1000) * Number(m.average_cost || 0);
  return q * Number(m.average_cost || 0);
};

export function CreateProductForm({ materials, machines, laborHourRate, energyCostKwh }: Props) {
  const r = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Bonecos");
  const [files, setFiles] = useState<FileList | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fdmMachines = machines.filter((m) => m.category === "Impressora FDM" && m.active);
  const resinMachines = machines.filter((m) => m.category === "Impressora Resina" && m.active);
  const fdmMaterials = materials.filter((m) => m.material_type === "Filamento");
  const resinMaterials = materials.filter((m) => m.material_type === "Resina");
  const [fdmEnabled, setFdmEnabled] = useState(false),
    [resinEnabled, setResinEnabled] = useState(false);
  const [fdmMachineId, setFdmMachineId] = useState(fdmMachines[0]?.id || ""),
    [fdmHours, setFdmHours] = useState("0");
  const [resinMachineId, setResinMachineId] = useState(resinMachines[0]?.id || ""),
    [resinHours, setResinHours] = useState("0");
  const [fdmItems, setFdmItems] = useState<Link[]>([]);
  const [fdmPickId, setFdmPickId] = useState(fdmMaterials[0]?.id || "");
  const [fdmPickQty, setFdmPickQty] = useState("0");
  const [resinItems, setResinItems] = useState<Link[]>([]);
  const [resinPickId, setResinPickId] = useState(resinMaterials[0]?.id || "");
  const [resinPickQty, setResinPickQty] = useState("0");
  const [extraLinks, setExtraLinks] = useState<Link[]>([]);
  const [extraMaterialId, setExtraMaterialId] = useState(materials[0]?.id || "");
  const [extraQty, setExtraQty] = useState("0");
  const [extraSearch, setExtraSearch] = useState("");
  const [paintingHours, setPaintingHours] = useState("0"),
    [finishingHours, setFinishingHours] = useState("0"),
    [paintingMaterials, setPaintingMaterials] = useState("0"),
    [packagingCost, setPackagingCost] = useState("0"),
    [otherCost, setOtherCost] = useState("0"),
    [lossPercent, setLossPercent] = useState("20"),
    [marginPercent, setMarginPercent] = useState("50");
  const [priceOverride, setPriceOverride] = useState("");
  const fdmMachine = fdmMachines.find((m) => m.id === fdmMachineId),
    resinMachine = resinMachines.find((m) => m.id === resinMachineId);
  const fdmMaterialCost = fdmEnabled
      ? fdmItems.reduce(
          (s, l) =>
            s +
            costOf(
              materials.find((m) => m.id === l.material_id),
              l.quantity
            ),
          0
        )
      : 0,
    resinMaterialCost = resinEnabled
      ? resinItems.reduce(
          (s, l) =>
            s +
            costOf(
              materials.find((m) => m.id === l.material_id),
              l.quantity
            ),
          0
        )
      : 0;
  const extraCost = extraLinks.reduce(
    (s, l) =>
      s +
      costOf(
        materials.find((m) => m.id === l.material_id),
        Number(l.quantity || 0)
      ),
    0
  );
  const materialCost = fdmMaterialCost + resinMaterialCost + extraCost;
  const waste = (materialCost * Number(lossPercent || 0)) / 100;
  const energy =
    (fdmEnabled ? Number(fdmHours || 0) * Number(fdmMachine?.power_kw || 0) : 0) +
    (resinEnabled ? Number(resinHours || 0) * Number(resinMachine?.power_kw || 0) : 0);
  const energyCost = energy * energyCostKwh;
  const depreciation =
    (fdmEnabled ? Number(fdmHours || 0) * Number(fdmMachine?.depreciation_per_hour || 0) : 0) +
    (resinEnabled ? Number(resinHours || 0) * Number(resinMachine?.depreciation_per_hour || 0) : 0);
  const labor = (Number(paintingHours || 0) + Number(finishingHours || 0)) * laborHourRate;
  const extras =
    Number(paintingMaterials || 0) + Number(packagingCost || 0) + Number(otherCost || 0);
  const total = materialCost + waste + energyCost + depreciation + labor + extras;
  const suggested = total * (1 + Number(marginPercent || 0) / 100);
  const profit = suggested - total;
  const finalPrice = priceOverride !== "" ? Number(priceOverride) || 0 : suggested;
  const finalProfit = finalPrice - total;
  function addExtra() {
    if (!extraMaterialId || Number(extraQty) <= 0) return;
    setExtraLinks((x) => [
      ...x.filter((a) => a.material_id !== extraMaterialId),
      { material_id: extraMaterialId, quantity: Number(extraQty), usage_type: "other" },
    ]);
  }
  function addFdmItem() {
    if (!fdmPickId || Number(fdmPickQty) <= 0) return;
    setFdmItems((x) => [
      ...x.filter((a) => a.material_id !== fdmPickId),
      { material_id: fdmPickId, quantity: Number(fdmPickQty), usage_type: "fdm" },
    ]);
    setFdmPickQty("0");
  }
  function removeFdmItem(materialId: string) {
    setFdmItems((x) => x.filter((a) => a.material_id !== materialId));
  }
  function addResinItem() {
    if (!resinPickId || Number(resinPickQty) <= 0) return;
    setResinItems((x) => [
      ...x.filter((a) => a.material_id !== resinPickId),
      { material_id: resinPickId, quantity: Number(resinPickQty), usage_type: "resin" },
    ]);
    setResinPickQty("0");
  }
  function removeResinItem(materialId: string) {
    setResinItems((x) => x.filter((a) => a.material_id !== materialId));
  }
  function reset() {
    setName("");
    setCategory("Bonecos");
    setFiles(null);
    if (ref.current) ref.current.value = "";
    setFdmEnabled(false);
    setResinEnabled(false);
    setFdmMachineId(fdmMachines[0]?.id || "");
    setResinMachineId(resinMachines[0]?.id || "");
    setFdmHours("0");
    setResinHours("0");
    setFdmItems([]);
    setFdmPickId(fdmMaterials[0]?.id || "");
    setFdmPickQty("0");
    setResinItems([]);
    setResinPickId(resinMaterials[0]?.id || "");
    setResinPickQty("0");
    setExtraLinks([]);
    setExtraQty("0");
    setExtraSearch("");
    setPaintingHours("0");
    setFinishingHours("0");
    setPaintingMaterials("0");
    setPackagingCost("0");
    setOtherCost("0");
    setLossPercent("20");
    setMarginPercent("50");
    setPriceOverride("");
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Nome é obrigatório.");
    if (!fdmEnabled && !resinEnabled) return setError("Selecione FDM, resina ou ambos.");
    if (fdmEnabled && (!fdmMachineId || Number(fdmHours) <= 0 || !fdmItems.length))
      return setError("Preencha máquina, horas e ao menos 1 filamento da FDM.");
    if (resinEnabled && (!resinMachineId || Number(resinHours) <= 0 || !resinItems.length))
      return setError("Preencha impressora, horas e ao menos 1 resina.");
    if (files && files.length > 8) return setError("Máximo de 8 fotos.");
    if (!Number.isFinite(finalPrice) || finalPrice <= 0)
      return setError("Informe um preço de venda válido.");
    setBusy(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          category,
          sale_price: finalPrice,
          estimated_cost: total,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Erro ao criar produto.");
      const productId = j.id;
      if (files?.length) {
        const sb = createClient();
        const {
          data: { user },
        } = await sb.auth.getUser();
        if (!user) throw new Error("Sessão expirada.");
        const rows: {
          product_id: string;
          storage_path: string;
          public_url: string;
          sort_order: number;
        }[] = [];
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          const ext = f.name.split(".").pop()?.toLowerCase() || "jpg";
          const path = `${user.id}/${productId}/${crypto.randomUUID()}.${ext}`;
          const up = await sb.storage
            .from("product-images")
            .upload(path, f, { contentType: f.type });
          if (up.error) throw up.error;
          const { data: url } = sb.storage.from("product-images").getPublicUrl(path);
          rows.push({
            product_id: productId,
            storage_path: path,
            public_url: url.publicUrl,
            sort_order: i,
          });
        }
        const ins = await sb.from("product_images").insert(rows);
        if (ins.error) throw ins.error;
      }
      const links: Link[] = [];
      if (fdmEnabled)
        links.push(
          ...fdmItems.map((l) => {
            const m = materials.find((x) => x.id === l.material_id);
            return {
              ...l,
              quantity: Number(l.quantity) / ((m?.unit || "").toLowerCase() === "kg" ? 1000 : 1),
            };
          })
        );
      if (resinEnabled)
        links.push(
          ...resinItems.map((l) => {
            const m = materials.find((x) => x.id === l.material_id);
            return {
              ...l,
              quantity: Number(l.quantity) / ((m?.unit || "").toLowerCase() === "kg" ? 1000 : 1),
            };
          })
        );
      links.push(
        ...extraLinks.map((l) => {
          const m = materials.find((x) => x.id === l.material_id);
          return {
            ...l,
            quantity: Number(l.quantity) / ((m?.unit || "").toLowerCase() === "kg" ? 1000 : 1),
          };
        })
      );
      for (const l of links) {
        const mr = await fetch("/api/product-materials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            product_id: productId,
            material_id: l.material_id,
            quantity: Number(l.quantity),
            usage_type: l.usage_type,
          }),
        });
        const mj = await mr.json();
        if (!mr.ok) throw new Error(mj.error || "Não foi possível salvar os materiais.");
      }
      const pricing = {
        product_id: productId,
        fdm_machine_id: fdmEnabled ? fdmMachineId : null,
        resin_machine_id: resinEnabled ? resinMachineId : null,
        fdm_material_id: fdmEnabled ? fdmItems[0]?.material_id || null : null,
        resin_material_id: resinEnabled ? resinItems[0]?.material_id || null : null,
        filament_hours: fdmEnabled ? Number(fdmHours) : 0,
        resin_hours: resinEnabled ? Number(resinHours) : 0,
        painting_hours: Number(paintingHours),
        finishing_hours: Number(finishingHours),
        labor_hour: laborHourRate,
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
      const pr = await fetch("/api/product-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pricing),
      });
      const pj = await pr.json();
      if (!pr.ok)
        throw new Error(pj.error || "Produto criado, mas não foi possível salvar a precificação.");
      reset();
      setOpen(false);
      r.refresh();
    } catch (err) {
      setError(errorMessage(err, "Erro."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {!open && (
        <button className="btn btn-primary" onClick={() => setOpen(true)}>
          + Novo produto
        </button>
      )}
      {open && (
        <form onSubmit={submit} className="card grid product-create-expanded">
          <div className="section-title">
            <div>
              <h2>Novo produto</h2>
              <p className="muted">
                Cadastre o produto, materiais, máquinas e custos. A comissão é definida somente no
                pedido.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setOpen(false);
                setError("");
              }}
            >
              Cancelar
            </button>
          </div>
          {error && <div className="error">{error}</div>}
          <div className="section-title">
            <h3>📦 Dados</h3>
          </div>
          <div className="form-grid">
            <Field label="Nome">
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
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
            <Field label="Fotos (até 8)">
              <input
                ref={ref}
                className="input"
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setFiles(e.target.files)}
              />
            </Field>
          </div>
          <div className="section-title" style={{ marginTop: 16 }}>
            <h3>🧵 Materiais consumidos</h3>
          </div>
          <>
            <div className="material-block">
              <label className="check-row" style={{ marginBottom: 12 }}>
                <input
                  type="checkbox"
                  checked={fdmEnabled}
                  onChange={(e) => setFdmEnabled(e.target.checked)}
                />{" "}
                <strong>🖨️ Usar FDM</strong>
              </label>
              {fdmEnabled && (
                <>
                  <div className="form-grid">
                    <Field label="Máquina FDM">
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
                    <Field label="Horas de impressão">
                      <HoursMinutesInput value={fdmHours} onChange={setFdmHours} />
                    </Field>
                    <Field label="Custo dos filamentos">
                      <div className="input">{money(fdmMaterialCost)}</div>
                    </Field>
                  </div>
                  <div className="form-grid" style={{ marginTop: 8 }}>
                    <Field label="Filamento">
                      <select
                        className="select"
                        value={fdmPickId}
                        onChange={(e) => setFdmPickId(e.target.value)}
                      >
                        <option value="">Selecione</option>
                        {fdmMaterials.length === 0 && (
                          <option value="" disabled>
                            Nenhum filamento cadastrado em Estoque
                          </option>
                        )}
                        {fdmMaterials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} {m.color_name ? `— ${m.color_name}` : ""} —{" "}
                            {money(Number(m.average_cost))}/{m.unit}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Quantidade (g)">
                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="0.001"
                        value={fdmPickQty}
                        onChange={(e) => setFdmPickQty(e.target.value)}
                      />
                    </Field>
                    <Field label="&nbsp;">
                      <button type="button" className="btn btn-secondary" onClick={addFdmItem}>
                        + Adicionar filamento
                      </button>
                    </Field>
                  </div>
                  {fdmItems.length > 0 && (
                    <table>
                      <thead>
                        <tr>
                          <th>Filamento</th>
                          <th>Quantidade</th>
                          <th>Custo</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {fdmItems.map((l) => {
                          const m = materials.find((x) => x.id === l.material_id);
                          return (
                            <tr key={l.material_id}>
                              <td>
                                {m?.name} {m?.color_name ? `— ${m.color_name}` : ""}
                              </td>
                              <td>{l.quantity} g</td>
                              <td>{money(costOf(m, l.quantity))}</td>
                              <td>
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  onClick={() => removeFdmItem(l.material_id)}
                                >
                                  Remover
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </>
              )}
            </div>

            <div className="material-block">
              <label className="check-row" style={{ marginBottom: 12 }}>
                <input
                  type="checkbox"
                  checked={resinEnabled}
                  onChange={(e) => setResinEnabled(e.target.checked)}
                />{" "}
                <strong>🧪 Usar resina</strong>
              </label>
              {resinEnabled && (
                <>
                  <div className="form-grid">
                    <Field label="Impressora de resina">
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
                    <Field label="Horas de impressão">
                      <HoursMinutesInput value={resinHours} onChange={setResinHours} />
                    </Field>
                    <Field label="Custo das resinas">
                      <div className="input">{money(resinMaterialCost)}</div>
                    </Field>
                  </div>
                  <div className="form-grid" style={{ marginTop: 8 }}>
                    <Field label="Resina">
                      <select
                        className="select"
                        value={resinPickId}
                        onChange={(e) => setResinPickId(e.target.value)}
                      >
                        <option value="">Selecione</option>
                        {resinMaterials.length === 0 && (
                          <option value="" disabled>
                            Nenhuma resina cadastrada em Estoque
                          </option>
                        )}
                        {resinMaterials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} {m.color_name ? `— ${m.color_name}` : ""} —{" "}
                            {money(Number(m.average_cost))}/{m.unit}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Quantidade (ml)">
                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="0.001"
                        value={resinPickQty}
                        onChange={(e) => setResinPickQty(e.target.value)}
                      />
                    </Field>
                    <Field label="&nbsp;">
                      <button type="button" className="btn btn-secondary" onClick={addResinItem}>
                        + Adicionar resina
                      </button>
                    </Field>
                  </div>
                  {resinItems.length > 0 && (
                    <table>
                      <thead>
                        <tr>
                          <th>Resina</th>
                          <th>Quantidade</th>
                          <th>Custo</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {resinItems.map((l) => {
                          const m = materials.find((x) => x.id === l.material_id);
                          return (
                            <tr key={l.material_id}>
                              <td>
                                {m?.name} {m?.color_name ? `— ${m.color_name}` : ""}
                              </td>
                              <td>{l.quantity} ml</td>
                              <td>{money(costOf(m, l.quantity))}</td>
                              <td>
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  onClick={() => removeResinItem(l.material_id)}
                                >
                                  Remover
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </>
              )}
            </div>

            <div className="material-block">
              <strong style={{ display: "block", marginBottom: 12 }}>
                🧴 Outros insumos (embalagem, tinta, acessórios...)
              </strong>
              <div className="form-grid">
                <Field label="Buscar insumo">
                  <input
                    className="input"
                    placeholder="Digite pra filtrar a lista abaixo"
                    value={extraSearch}
                    onChange={(e) => setExtraSearch(e.target.value)}
                  />
                </Field>
                <Field label="Insumo">
                  <select
                    className="select"
                    value={extraMaterialId}
                    onChange={(e) => setExtraMaterialId(e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {materials
                      .filter((m) => m.category === "Insumos")
                      .filter((m) =>
                        (m.name + " " + (m.color_name || ""))
                          .toLowerCase()
                          .includes(extraSearch.trim().toLowerCase())
                      )
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} {m.color_name ? `— ${m.color_name}` : ""} —{" "}
                          {money(Number(m.average_cost))}/{m.unit}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field
                  label={
                    isWeight(materials.find((m) => m.id === extraMaterialId)?.unit || "")
                      ? "Quantidade usada (g)"
                      : "Quantidade"
                  }
                >
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.001"
                    value={extraQty}
                    onChange={(e) => setExtraQty(e.target.value)}
                  />
                </Field>
                <Field label="&nbsp;">
                  <button type="button" className="btn btn-secondary" onClick={addExtra}>
                    Adicionar insumo
                  </button>
                </Field>
              </div>
              {extraLinks.length > 0 && (
                <table>
                  <thead>
                    <tr>
                      <th>Insumo</th>
                      <th>Quantidade</th>
                      <th>Custo</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {extraLinks.map((l) => {
                      const m = materials.find((x) => x.id === l.material_id);
                      return (
                        <tr key={l.material_id}>
                          <td>{m?.name}</td>
                          <td>
                            {l.quantity} {isWeight(m?.unit || "") ? "g" : m?.unit}
                          </td>
                          <td>{money(costOf(m, Number(l.quantity)))}</td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() =>
                                setExtraLinks((x) =>
                                  x.filter((a) => a.material_id !== l.material_id)
                                )
                              }
                            >
                              Remover
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
          <div className="section-title" style={{ marginTop: 16 }}>
            <h3>🎨 Pintura</h3>
          </div>
          <div className="form-grid">
            <Field label="Horas de pintura">
              <HoursMinutesInput value={paintingHours} onChange={setPaintingHours} />
            </Field>
            <Field label="Horas de acabamento">
              <HoursMinutesInput value={finishingHours} onChange={setFinishingHours} />
            </Field>
            <Field label="Valor cobrado por hora">
              <div className="input">{money(laborHourRate)}</div>
            </Field>
            <Field label="Materiais de pintura">
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={paintingMaterials}
                onChange={(e) => setPaintingMaterials(e.target.value)}
              />
            </Field>
            <Field label="Embalagem">
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={packagingCost}
                onChange={(e) => setPackagingCost(e.target.value)}
              />
            </Field>
            <Field label="Outros custos">
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={otherCost}
                onChange={(e) => setOtherCost(e.target.value)}
              />
            </Field>
          </div>
          <div className="section-title" style={{ marginTop: 16 }}>
            <h3>📊 Margem</h3>
          </div>
          <div className="form-grid">
            <Field label="Perda/refugo (%)">
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={lossPercent}
                onChange={(e) => setLossPercent(e.target.value)}
              />
            </Field>
            <Field label="Margem desejada (%)">
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={marginPercent}
                onChange={(e) => setMarginPercent(e.target.value)}
              />
            </Field>
          </div>
          <div className="card" style={{ marginTop: 16 }}>
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
                <br />
                <small className="muted">Lucro no sugerido: {money(profit)}</small>
              </p>
              <p>
                <strong>Preço de venda</strong>
                <br />
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder={suggested.toFixed(2)}
                    value={priceOverride}
                    onChange={(e) => setPriceOverride(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setPriceOverride("")}
                    title="Usar o preço calculado pela fórmula"
                  >
                    Usar sugerido
                  </button>
                </div>
                <small className={`muted ${finalProfit < 0 ? "error" : ""}`}>
                  Lucro no preço escolhido: {money(finalProfit)}
                </small>
              </p>
            </div>
          </div>
          <div className="actions" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Cadastrando..." : "Cadastrar produto"}
            </button>
          </div>
        </form>
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
