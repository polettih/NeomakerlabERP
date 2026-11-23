"use client";
/* eslint-disable @next/next/no-img-element -- fotos vêm de URLs externas (Shopee/Storage); next/image exigiria liberar cada domínio */
import { FormEvent, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/format";
import { errorMessage } from "@/lib/errors";
import { FormTabs } from "@/components/form-tabs";
import { HoursMinutesInput } from "@/components/hours-minutes-input";
import { MaterialPicker } from "@/components/material-picker";
import { ProductImport } from "@/components/product-import";
import { VariantsEditor, validateVariants, variantsPayload } from "@/components/variants-editor";
import { toStoredQuantity } from "@/lib/product-materials";
import {
  computeCost,
  defaultModel,
  manualLineCost,
  modelFromLegacy,
  parseCostModel,
  pricingPayload,
  uid,
  type CostModel,
  type ManualLine,
  type PrintBlock,
} from "@/lib/cost-model";
import { toDraft, type Variant, type VariantDraft } from "@/lib/variants";

const cats = ["Bonecos", "Objetos", "Miniaturas", "Decoração", "Outros"];

export type Material = {
  id: string;
  name: string;
  category: string;
  unit: string;
  average_cost: number;
  material_type?: string;
  color_name?: string;
  color_hex?: string;
};
export type Machine = {
  id: string;
  name: string;
  category: string;
  power_kw: number;
  depreciation_per_hour: number;
  active: boolean;
};
type Img = { id: string; public_url: string; storage_path: string; sort_order: number };
export type EditableProduct = {
  id: string;
  name: string;
  sale_price: number;
  estimated_cost: number;
  category: string;
  images: Img[];
};
type Props = {
  /** Sem produto = cadastro novo; com produto = edição. */
  product?: EditableProduct;
  materials: Material[];
  machines: Machine[];
  laborHourRate: number;
  energyCostKwh: number;
  organizationId: string;
  /** Produtos já cadastrados (só para a importação da Shopee evitar duplicar). */
  existingProducts?: { id: string; name: string; external_ids: Record<string, string> | null }[];
};

const usageOf = (m?: Material) =>
  m?.material_type === "Filamento" ? "fdm" : m?.material_type === "Resina" ? "resin" : "other";
const isKgUnit = (m?: Material) => (m?.unit || "").toLowerCase() === "kg";
const qtyLabel = (m?: Material) => (isKgUnit(m) ? "g" : m?.unit || "un");

/** Campo numérico que aceita digitar "0,", "1." etc. sem travar, e devolve sempre um número. */
function NumInput({
  value,
  onChange,
  step = "any",
  placeholder = "0",
  ariaLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  step?: string;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const [text, setText] = useState(value ? String(value) : "");
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) {
      last.current = value;
      setText(value ? String(value) : "");
    }
  }, [value]);
  return (
    <input
      className="input"
      type="number"
      inputMode="decimal"
      min="0"
      step={step}
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const n = e.target.value === "" ? 0 : Number(e.target.value);
        last.current = Number.isFinite(n) ? n : 0;
        onChange(last.current);
      }}
    />
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <small className="muted">{hint}</small>}
    </div>
  );
}

const pct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const num2 = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export function ProductForm({
  product,
  materials,
  machines,
  laborHourRate,
  energyCostKwh,
  organizationId,
  existingProducts = [],
}: Props) {
  const isEdit = !!product;
  const r = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"manual" | "import">("manual");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState(product?.category || "Bonecos");
  const [priceText, setPriceText] = useState(product ? String(product.sale_price) : "");
  const [model, setModel] = useState<CostModel>(() =>
    defaultModel({ laborRate: laborHourRate, energyKwh: energyCostKwh })
  );
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [variantsLoaded, setVariantsLoaded] = useState(!isEdit);
  const [files, setFiles] = useState<FileList | null>(null);
  const [images, setImages] = useState<Img[]>(product?.images ?? []);
  const [pickId, setPickId] = useState("");
  const [pickAmount, setPickAmount] = useState(0);
  const [overrideOn, setOverrideOn] = useState(false);

  const activeMachines = machines.filter((m) => m.active);
  const b = computeCost(model, materials);
  const finalPrice = priceText !== "" ? Number(priceText) || 0 : b.suggested;
  const profit = finalPrice - b.total;
  const marginReal = finalPrice > 0 ? (profit / finalPrice) * 100 : 0;
  const patch = (p: Partial<CostModel>) => setModel((m) => ({ ...m, ...p }));
  const patchPrint = (k: "fdm" | "resin", p: Partial<PrintBlock>) =>
    setModel((m) => ({ ...m, [k]: { ...m[k], ...p } }));

  function resetNew() {
    setName("");
    setCategory("Bonecos");
    setPriceText("");
    setModel(defaultModel({ laborRate: laborHourRate, energyKwh: energyCostKwh }));
    setVariants([]);
    setFiles(null);
    if (fileRef.current) fileRef.current.value = "";
    setPickId("");
    setPickAmount(0);
    setOverrideOn(false);
  }

  async function openEdit() {
    if (!product) return;
    setOpen(true);
    setLoading(true);
    setError("");
    try {
      const [pr, pm, vr] = await Promise.all([
        fetch(`/api/product-pricing?product_id=${product.id}`),
        fetch(`/api/product-materials?product_id=${product.id}`),
        fetch(`/api/product-variants?product_id=${product.id}`),
      ]);
      const pricing = pr.ok ? await pr.json() : null;
      const links = pm.ok ? await pm.json() : [];
      const defaults = { laborRate: laborHourRate, energyKwh: energyCostKwh };
      const saved = parseCostModel(pricing?.cost_model);
      const m = saved ?? modelFromLegacy(pricing, links, materials, defaults);
      setModel(m);
      setOverrideOn(m.total_override !== null);
      if (vr.ok) {
        setVariants(((await vr.json()) as Variant[]).map(toDraft));
        setVariantsLoaded(true);
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  // ---- materiais do estoque ----------------------------------------------------------
  function addStock() {
    if (!pickId || pickAmount <= 0) return;
    setModel((m) => ({
      ...m,
      stock: [
        ...m.stock.filter((l) => l.material_id !== pickId),
        { key: uid(), material_id: pickId, amount: pickAmount },
      ],
    }));
    setPickAmount(0);
  }
  const addManual = () =>
    setModel((m) => ({
      ...m,
      manual: [...m.manual, { key: uid(), label: "", amount: 0, unit: "g", price: 0 }],
    }));
  const patchManual = (key: string, p: Partial<ManualLine>) =>
    setModel((m) => ({ ...m, manual: m.manual.map((l) => (l.key === key ? { ...l, ...p } : l)) }));

  function pickMachine(k: "fdm" | "resin", id: string) {
    const mc = machines.find((x) => x.id === id);
    patchPrint(k, {
      machine_id: id,
      ...(mc
        ? { power_kw: Number(mc.power_kw || 0), depr_hour: Number(mc.depreciation_per_hour || 0) }
        : {}),
    });
  }

  // ---- salvar ------------------------------------------------------------------------
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Nome é obrigatório.");
    if (!(finalPrice > 0)) return setError("Informe o preço de venda (aba Custo e preço).");
    if (files && files.length + images.length > 8) return setError("Máximo de 8 fotos.");
    const variantError = validateVariants(variants);
    if (variantError) return setError(variantError);
    if (overrideOn && !(model.total_override !== null && model.total_override >= 0))
      return setError("Informe o custo manual ou desligue essa opção.");
    const clean: CostModel = {
      ...model,
      total_override: overrideOn ? (model.total_override ?? 0) : null,
      stock: model.stock.filter((l) => l.amount > 0),
      manual: model.manual
        .filter((l) => l.amount > 0)
        .map((l) => ({ ...l, label: l.label.trim() || "Material manual" })),
    };
    const calc = computeCost(clean, materials);
    setBusy(true);
    try {
      const res = await fetch("/api/products/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: product?.id,
          product: {
            name: name.trim(),
            category,
            sale_price: finalPrice,
            estimated_cost: calc.total,
          },
          materials: clean.stock.map((l) => {
            const mat = materials.find((x) => x.id === l.material_id);
            return {
              material_id: l.material_id,
              quantity: toStoredQuantity(mat, l.amount),
              usage_type: usageOf(mat),
            };
          }),
          pricing: pricingPayload(clean, calc, materials),
          // Na edição só envia se carregou, para nunca apagar variações por engano.
          variants: variantsLoaded ? variantsPayload(variants) : undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Erro ao salvar produto.");
      if (!isEdit && files?.length) {
        try {
          await uploadFiles(j.id, files, 0);
        } catch (photoErr) {
          resetNew();
          r.refresh();
          throw new Error(
            `Produto salvo, mas as fotos não foram enviadas (${errorMessage(photoErr, "erro")}). Adicione-as editando o produto.`
          );
        }
      }
      if (isEdit) setOpen(false);
      else {
        resetNew();
        setOpen(false);
      }
      r.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function uploadFiles(productId: string, list: FileList, startOrder: number) {
    const sb = createClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) throw new Error("Sessão expirada.");
    const rows = [];
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      const ext = f.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${productId}/${crypto.randomUUID()}.${ext}`;
      const up = await sb.storage
        .from("product-images")
        .upload(path, f, { upsert: false, contentType: f.type });
      if (up.error) throw up.error;
      const { data: url } = sb.storage.from("product-images").getPublicUrl(path);
      rows.push({
        product_id: productId,
        organization_id: organizationId,
        storage_path: path,
        public_url: url.publicUrl,
        sort_order: startOrder + i,
      });
    }
    const ins = await sb
      .from("product_images")
      .insert(rows)
      .select("id,public_url,storage_path,sort_order");
    if (ins.error) throw ins.error;
    return ins.data as Img[];
  }

  async function addPhotosNow(list: FileList | null) {
    if (!product || !list?.length) return;
    if (images.length + list.length > 8) return setError("Máximo de 8 fotos.");
    setBusy(true);
    try {
      const added = await uploadFiles(product.id, list, images.length);
      setImages((x) => [...x, ...added]);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function removePhoto(img: Img) {
    if (!confirm("Remover esta foto?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/product-images/${img.id}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Erro");
      setImages((x) => x.filter((i) => i.id !== img.id));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  // ---- seções ------------------------------------------------------------------------
  const dados = (
    <div className="grid" style={{ gap: 14 }}>
      <div className="form-grid">
        <Field label="Nome do produto">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </Field>
        <Field label="Categoria">
          <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
            {cats.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>
      {!isEdit && (
        <Field label="Fotos (até 8)">
          <input
            ref={fileRef}
            className="input"
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setFiles(e.target.files)}
          />
        </Field>
      )}
    </div>
  );

  const stockLines = model.stock.map((l) => {
    const mat = materials.find((x) => x.id === l.material_id);
    const cost = computeCost({ ...model, stock: [l], manual: [] }, materials).stockCost;
    return { l, mat, cost };
  });

  const materiaisTab = (
    <div className="grid" style={{ gap: 14 }}>
      <div className="material-block">
        <strong>📦 Do estoque</strong>
        <p className="muted">
          Usa o preço médio do estoque e baixa o material quando o pedido entra em produção.
        </p>
        <div className="form-grid">
          <Field label="Material">
            <MaterialPicker materials={materials} value={pickId} onChange={setPickId} />
          </Field>
          <Field label={`Quantidade (${qtyLabel(materials.find((m) => m.id === pickId))})`}>
            <NumInput
              value={pickAmount}
              onChange={setPickAmount}
              ariaLabel="Quantidade do material"
            />
          </Field>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={addStock}
          style={{ marginTop: 8 }}
        >
          + Adicionar do estoque
        </button>
        {stockLines.length > 0 && (
          <table style={{ marginTop: 10 }}>
            <thead>
              <tr>
                <th>Material</th>
                <th style={{ width: 130 }}>Quantidade</th>
                <th>Custo</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {stockLines.map(({ l, mat, cost }) => (
                <tr key={l.key}>
                  <td>
                    {mat?.name ?? "Material removido"}
                    {mat?.color_name ? ` — ${mat.color_name}` : ""}
                  </td>
                  <td>
                    <NumInput
                      value={l.amount}
                      ariaLabel={`Quantidade de ${mat?.name ?? "material"}`}
                      onChange={(n) =>
                        setModel((m) => ({
                          ...m,
                          stock: m.stock.map((x) => (x.key === l.key ? { ...x, amount: n } : x)),
                        }))
                      }
                    />
                    <small className="muted">{qtyLabel(mat)}</small>
                  </td>
                  <td>{money(cost)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() =>
                        setModel((m) => ({ ...m, stock: m.stock.filter((x) => x.key !== l.key) }))
                      }
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="material-block">
        <strong>✍️ Manual (gramas / ml)</strong>
        <p className="muted">
          Digite a quantidade e o preço do kg (ou do litro) direto, sem precisar ter o material
          cadastrado. Não baixa estoque.
        </p>
        {model.manual.map((l) => (
          <div
            key={l.key}
            className="form-grid"
            style={{
              gridTemplateColumns: "2fr 1fr 1fr 1fr auto",
              alignItems: "end",
              marginBottom: 8,
            }}
          >
            <Field label="Descrição">
              <input
                className="input"
                placeholder="Ex.: PLA roxo"
                value={l.label}
                onChange={(e) => patchManual(l.key, { label: e.target.value })}
              />
            </Field>
            <Field label="Quantidade">
              <NumInput
                value={l.amount}
                onChange={(n) => patchManual(l.key, { amount: n })}
                ariaLabel="Quantidade manual"
              />
            </Field>
            <Field label="Unidade">
              <select
                className="select"
                value={l.unit}
                onChange={(e) => patchManual(l.key, { unit: e.target.value as "g" | "ml" })}
              >
                <option value="g">gramas</option>
                <option value="ml">ml</option>
              </select>
            </Field>
            <Field label={l.unit === "g" ? "R$ por kg" : "R$ por litro"}>
              <NumInput
                value={l.price}
                onChange={(n) => patchManual(l.key, { price: n })}
                ariaLabel="Preço"
              />
            </Field>
            <div>
              <small className="muted">{money(manualLineCost(l))}</small>{" "}
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() =>
                  setModel((m) => ({ ...m, manual: m.manual.filter((x) => x.key !== l.key) }))
                }
              >
                ✕
              </button>
            </div>
          </div>
        ))}
        <button type="button" className="btn btn-secondary btn-sm" onClick={addManual}>
          + Adicionar material manual
        </button>
      </div>

      <Field label="Perda e refugo (%)" hint="Somado sobre o custo de material (padrão 20%).">
        <NumInput
          value={model.loss_percent}
          onChange={(n) => patch({ loss_percent: n })}
          ariaLabel="Perda"
        />
      </Field>
    </div>
  );

  const printBlock = (k: "fdm" | "resin", title: string, category: string) => {
    const blk = model[k];
    const list = activeMachines.filter((m) => m.category === category);
    return (
      <div className="material-block" key={k}>
        <label className="check-row">
          <input
            type="checkbox"
            checked={blk.enabled}
            onChange={(e) => patchPrint(k, { enabled: e.target.checked })}
          />{" "}
          <strong>{title}</strong>
        </label>
        {blk.enabled && (
          <div className="form-grid" style={{ marginTop: 10 }}>
            <Field label="Tempo de impressão">
              <HoursMinutesInput
                value={String(blk.hours)}
                onChange={(v) => patchPrint(k, { hours: Number(v) || 0 })}
              />
            </Field>
            <Field
              label="Máquina (opcional)"
              hint="Preenche potência e depreciação; você pode ajustar."
            >
              <select
                className="select"
                value={blk.machine_id}
                onChange={(e) => pickMachine(k, e.target.value)}
              >
                <option value="">Sem máquina — informar manualmente</option>
                {list.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Potência (kW)">
              <NumInput
                value={blk.power_kw}
                onChange={(n) => patchPrint(k, { power_kw: n })}
                ariaLabel="Potência"
              />
            </Field>
            <Field label="Depreciação (R$/hora)">
              <NumInput
                value={blk.depr_hour}
                onChange={(n) => patchPrint(k, { depr_hour: n })}
                ariaLabel="Depreciação"
              />
            </Field>
          </div>
        )}
      </div>
    );
  };

  const tempoTab = (
    <div className="grid" style={{ gap: 14 }}>
      {printBlock("fdm", "🖨️ Impressão FDM (filamento)", "Impressora FDM")}
      {printBlock("resin", "💧 Impressão em resina", "Impressora Resina")}
      <div className="material-block">
        <strong>🧑‍🎨 Horas de trabalho</strong>
        <div className="form-grid" style={{ marginTop: 10 }}>
          <Field label="Pintura">
            <HoursMinutesInput
              value={String(model.painting_hours)}
              onChange={(v) => patch({ painting_hours: Number(v) || 0 })}
            />
          </Field>
          <Field label="Acabamento / montagem">
            <HoursMinutesInput
              value={String(model.finishing_hours)}
              onChange={(v) => patch({ finishing_hours: Number(v) || 0 })}
            />
          </Field>
          <Field
            label="Valor da hora de trabalho (R$)"
            hint="Padrão vem das Configurações; vale só para este produto."
          >
            <NumInput
              value={model.labor_rate}
              onChange={(n) => patch({ labor_rate: n })}
              ariaLabel="Valor da hora"
            />
          </Field>
          <Field label="Tarifa de energia (R$/kWh)">
            <NumInput
              value={model.energy_kwh_cost}
              onChange={(n) => patch({ energy_kwh_cost: n })}
              ariaLabel="Tarifa"
            />
          </Field>
        </div>
      </div>
      <div className="material-block">
        <strong>🎁 Outros custos (R$)</strong>
        <div className="form-grid" style={{ marginTop: 10 }}>
          <Field label="Insumos de pintura">
            <NumInput
              value={model.painting_materials}
              onChange={(n) => patch({ painting_materials: n })}
            />
          </Field>
          <Field label="Embalagem">
            <NumInput value={model.packaging_cost} onChange={(n) => patch({ packaging_cost: n })} />
          </Field>
          <Field label="Outros">
            <NumInput value={model.other_cost} onChange={(n) => patch({ other_cost: n })} />
          </Field>
        </div>
      </div>
    </div>
  );

  const row = (label: string, formula: string, value: number) => (
    <tr key={label}>
      <td>{label}</td>
      <td className="muted">{formula}</td>
      <td style={{ textAlign: "right" }}>{money(value)}</td>
    </tr>
  );
  const custoTab = (
    <div className="grid" style={{ gap: 14 }}>
      <div className="material-block">
        <strong>🧮 Como o custo foi calculado</strong>
        <table style={{ marginTop: 8 }}>
          <tbody>
            {row(
              "Material",
              `${model.stock.length} do estoque + ${model.manual.length} manual`,
              b.materialCost
            )}
            {row("Perda e refugo", `${pct(model.loss_percent)} do material`, b.waste)}
            {row(
              "Energia",
              `${num2(b.energyKwh)} kWh × ${money(model.energy_kwh_cost)}`,
              b.energyCost
            )}
            {row("Depreciação das máquinas", "horas de impressão × R$/hora", b.depreciation)}
            {row(
              "Mão de obra",
              `${num2(model.painting_hours + model.finishing_hours)} h × ${money(model.labor_rate)}`,
              b.labor
            )}
            {row("Outros custos", "pintura + embalagem + outros", b.extras)}
            <tr>
              <td>
                <strong>Custo calculado</strong>
              </td>
              <td />
              <td style={{ textAlign: "right" }}>
                <strong>{money(b.calculated)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
        <label className="check-row" style={{ marginTop: 10 }}>
          <input
            type="checkbox"
            checked={overrideOn}
            onChange={(e) => {
              setOverrideOn(e.target.checked);
              patch({
                total_override: e.target.checked ? Math.round(b.calculated * 100) / 100 : null,
              });
            }}
          />{" "}
          Definir o custo manualmente (ignora a conta acima)
        </label>
        {overrideOn && (
          <Field
            label="Custo total do produto (R$)"
            hint="O recálculo automático não altera este produto."
          >
            <NumInput
              value={model.total_override ?? 0}
              onChange={(n) => patch({ total_override: n })}
              ariaLabel="Custo manual"
            />
          </Field>
        )}
      </div>
      <div className="form-grid">
        <Field label="Margem desejada (%)">
          <NumInput
            value={model.margin_percent}
            onChange={(n) => patch({ margin_percent: n })}
            ariaLabel="Margem"
          />
        </Field>
        <Field label="Preço sugerido">
          <input className="input" readOnly value={money(b.suggested)} />
        </Field>
        <Field label="Preço de venda (R$)" hint="Vazio = usa o preço sugerido.">
          <input
            className="input"
            type="number"
            min="0"
            step="0.01"
            placeholder={b.suggested.toFixed(2)}
            value={priceText}
            onChange={(e) => setPriceText(e.target.value)}
          />
        </Field>
        {b.suggested > 0 && priceText !== "" && (
          <div className="field">
            <label>&nbsp;</label>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setPriceText("")}
            >
              Usar o sugerido ({money(b.suggested)})
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const variacoesTab = (
    <VariantsEditor
      variants={variants}
      onChange={setVariants}
      productCost={b.total}
      basePrice={finalPrice}
      suggestedPrice={b.suggested}
    />
  );

  const fotosTab = isEdit ? (
    <div className="grid" style={{ gap: 12 }}>
      <input
        className="input"
        type="file"
        accept="image/*"
        multiple
        disabled={busy || images.length >= 8}
        onChange={(e) => addPhotosNow(e.target.files)}
      />
      <div className="photo-grid">
        {images.map((img) => (
          <div className="photo-item" key={img.id}>
            <img src={img.public_url} alt="" loading="lazy" />
            <div className="photo-caption">
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => removePhoto(img)}
                disabled={busy}
              >
                Remover
              </button>
            </div>
          </div>
        ))}
        {!images.length && <p className="muted">Nenhuma foto.</p>}
      </div>
    </div>
  ) : null;

  const sections = [
    { id: "dados", label: "📦 Dados", content: dados },
    { id: "materiais", label: "🧵 Materiais", content: materiaisTab },
    { id: "tempo", label: "⏱️ Tempo e mão de obra", content: tempoTab },
    { id: "custo", label: "💰 Custo e preço", content: custoTab },
    {
      id: "variacoes",
      label: `🎨 Variações${variants.length ? ` (${variants.length})` : ""}`,
      content: variacoesTab,
    },
    ...(fotosTab
      ? [{ id: "fotos", label: `📸 Fotos (${images.length}/8)`, content: fotosTab }]
      : []),
  ];

  const summaryBar = (
    <div
      style={{
        position: "sticky",
        bottom: 0,
        background: "var(--panel)",
        borderTop: "1px solid var(--border)",
        padding: "12px 0",
        display: "flex",
        gap: 16,
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
      }}
    >
      <span>
        Custo <strong>{money(b.total)}</strong> · Preço <strong>{money(finalPrice)}</strong> · Lucro{" "}
        <strong style={{ color: profit < 0 ? "#ef4444" : undefined }}>
          {money(profit)} ({marginReal.toFixed(0)}%)
        </strong>
      </span>
      <button className="btn btn-primary" disabled={busy || loading}>
        {busy ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar produto"}
      </button>
    </div>
  );

  const header = (title: string, subtitle: string) => (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        <p className="muted">{subtitle}</p>
      </div>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => {
          setOpen(false);
          setError("");
        }}
      >
        {isEdit ? "Fechar" : "Cancelar"}
      </button>
    </div>
  );

  const body = (
    <form onSubmit={submit} className="grid" style={{ gap: 14 }}>
      {error && <div className="error">{error}</div>}
      {loading ? (
        <p className="muted">Carregando dados do produto...</p>
      ) : (
        <FormTabs sections={sections} />
      )}
      {summaryBar}
    </form>
  );

  if (isEdit)
    return (
      <>
        <button className="btn btn-secondary btn-sm" onClick={openEdit}>
          Editar
        </button>
        {open && (
          <div className="modal-backdrop">
            <div className="modal card">
              {header(
                `Editar: ${product?.name}`,
                "Altere dados, materiais, tempos e o cálculo de custo."
              )}
              {body}
            </div>
          </div>
        )}
      </>
    );

  return (
    <>
      {!open && (
        <button className="btn btn-primary" onClick={() => setOpen(true)}>
          + Novo produto
        </button>
      )}
      {open && (
        <div className="card grid product-create-expanded">
          {header("Novo produto", "Cadastre manualmente ou importe os produtos da Shopee.")}
          <div className="page-tabs" role="tablist">
            <button
              type="button"
              className={`page-tab ${mode === "manual" ? "page-tab-active" : ""}`}
              onClick={() => setMode("manual")}
            >
              ✍️ Cadastrar manualmente
            </button>
            <button
              type="button"
              className={`page-tab ${mode === "import" ? "page-tab-active" : ""}`}
              onClick={() => setMode("import")}
            >
              📥 Importar da Shopee
            </button>
          </div>
          {mode === "manual" ? body : <ProductImport existingProducts={existingProducts} />}
        </div>
      )}
    </>
  );
}
