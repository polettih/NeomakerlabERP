import type { SupabaseClient } from "@supabase/supabase-js";

export type VariantInput = {
  id?: string;
  name: string;
  sku?: string | null;
  sale_price: number | string;
  units?: number | string;
  cost_override?: number | string | null;
  active?: boolean;
};

/** Valida e normaliza a lista de variações; lança Error com mensagem em português. */
export function normalizeVariants(list: VariantInput[], organizationId: string, productId: string) {
  const seen = new Set<string>();
  return list.map((v, idx) => {
    const name = String(v.name ?? "").trim();
    if (!name) throw new Error("Toda variação precisa de um nome.");
    const key = name.toLowerCase();
    if (seen.has(key)) throw new Error(`Variação repetida: "${name}".`);
    seen.add(key);
    const price = Number(v.sale_price);
    if (!Number.isFinite(price) || price < 0) throw new Error(`Preço inválido em "${name}".`);
    const units = Number(v.units ?? 1);
    if (!Number.isFinite(units) || units <= 0) throw new Error(`Unidades inválidas em "${name}".`);
    const hasCost =
      v.cost_override !== null && v.cost_override !== undefined && String(v.cost_override) !== "";
    const cost = hasCost ? Number(v.cost_override) : null;
    if (cost !== null && (!Number.isFinite(cost) || cost < 0))
      throw new Error(`Custo inválido em "${name}".`);
    return {
      id: v.id,
      organization_id: organizationId,
      product_id: productId,
      name,
      sku: v.sku?.toString().trim() || null,
      sale_price: price,
      units,
      cost_override: cost,
      active: v.active !== false,
      sort_order: idx,
      updated_at: new Date().toISOString(),
    };
  });
}

/**
 * Sincroniza a lista completa de variações de um produto: atualiza as existentes (pelo id),
 * cria as novas e remove as que saíram da lista.
 */
export async function syncVariants(
  supabase: SupabaseClient,
  organizationId: string,
  productId: string,
  list: VariantInput[]
) {
  const rows = normalizeVariants(list, organizationId, productId);
  const { data: current, error: ce } = await supabase
    .from("product_variants")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("product_id", productId);
  if (ce) throw ce;
  const keepIds = new Set(rows.map((r) => r.id).filter(Boolean) as string[]);
  const toDelete = (current ?? []).map((c) => c.id).filter((id) => !keepIds.has(id));
  if (toDelete.length) {
    const { error } = await supabase
      .from("product_variants")
      .delete()
      .eq("organization_id", organizationId)
      .in("id", toDelete);
    if (error) throw error;
  }
  for (const r of rows) {
    const { id, ...fields } = r;
    if (id) {
      const { error } = await supabase
        .from("product_variants")
        .update(fields)
        .eq("id", id)
        .eq("organization_id", organizationId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("product_variants").insert(fields);
      if (error) throw error;
    }
  }
  return rows.length;
}
