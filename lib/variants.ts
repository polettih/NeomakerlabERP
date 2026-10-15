/** Tipos e regras compartilhadas das variações de produto (estilo Shopee). */
export type Variant = {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
  sale_price: number;
  units: number;
  cost_override: number | null;
  active: boolean;
  sort_order: number;
};

/** Variação ainda não salva/em edição na tela. `id` só existe para as já gravadas. */
export type VariantDraft = {
  key: string;
  id?: string;
  name: string;
  sku: string;
  sale_price: string;
  units: string;
  cost_override: string; // vazio = usar custo do produto × unidades
  active: boolean;
};

/** Custo de uma variação: custo próprio se informado, senão custo do produto × unidades. */
export function variantCost(
  v: { units: number | string; cost_override: number | string | null },
  productCost: number
): number {
  if (
    v.cost_override !== null &&
    v.cost_override !== "" &&
    Number.isFinite(Number(v.cost_override))
  )
    return Number(v.cost_override);
  const units = Number(v.units);
  return productCost * (Number.isFinite(units) && units > 0 ? units : 1);
}

/** Tenta descobrir quantas unidades o nome da variação indica ("Roxo,2 unidades" → 2). */
export function guessUnits(name: string): number {
  const m = name.match(/(\d+(?:[.,]\d+)?)\s*(?:un\b|und\b|unid|pe[cç]as?|pcs|kit)/i);
  if (m) {
    const v = Number(m[1].replace(",", "."));
    if (Number.isFinite(v) && v > 0) return v;
  }
  return 1;
}

export const newVariantDraft = (patch: Partial<VariantDraft> = {}): VariantDraft => ({
  key: Math.random().toString(36).slice(2),
  name: "",
  sku: "",
  sale_price: "",
  units: "1",
  cost_override: "",
  active: true,
  ...patch,
});

export const toDraft = (v: Variant): VariantDraft => ({
  key: v.id,
  id: v.id,
  name: v.name,
  sku: v.sku ?? "",
  sale_price: String(v.sale_price ?? ""),
  units: String(v.units ?? 1),
  cost_override:
    v.cost_override === null || v.cost_override === undefined ? "" : String(v.cost_override),
  active: v.active,
});
