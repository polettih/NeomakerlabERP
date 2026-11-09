import type { SupabaseClient } from "@supabase/supabase-js";
import { n } from "@/lib/format";

export type ShoppingRow = {
  material_id: string;
  name: string;
  unit: string;
  color_name: string | null;
  on_hand: number;
  minimum: number;
  /** Quantidade que os pedidos ainda não iniciados vão consumir. */
  needed: number;
  /** Sugestão de compra: cobre o que falta para os pedidos e recompõe o estoque mínimo. */
  to_buy: number;
  /** Custo estimado da compra sugerida (pelo custo médio). */
  estimated_cost: number;
};

type MaterialLite = {
  id: string;
  name: string;
  unit: string;
  color_name?: string | null;
  quantity_on_hand: number | string | null;
  minimum_stock: number | string | null;
  average_cost: number | string | null;
};

/**
 * Monta a lista de compras sugerida: soma o consumo de material dos pedidos que ainda não
 * entraram em produção (novo/preparação) — respeitando as unidades da variação vendida e as
 * trocas de material feitas no pedido — e compara com o estoque e o estoque mínimo.
 */
export async function buildShoppingList(
  supabase: SupabaseClient,
  organizationId: string,
  materials: MaterialLite[]
): Promise<ShoppingRow[]> {
  const { data: orders } = await supabase
    .from("orders")
    .select("id")
    .eq("organization_id", organizationId)
    .in("status", ["new", "preparation"]);
  const orderIds = (orders ?? []).map((o) => o.id);
  const needed = new Map<string, number>();
  if (orderIds.length) {
    const { data: items } = await supabase
      .from("order_items")
      .select("id,product_id,quantity,variant_id")
      .in("order_id", orderIds);
    const itemList = items ?? [];
    const itemIds = itemList.map((i) => i.id);
    const productIds = [...new Set(itemList.map((i) => i.product_id).filter(Boolean))] as string[];
    const variantIds = [...new Set(itemList.map((i) => i.variant_id).filter(Boolean))] as string[];
    const [{ data: overrides }, { data: links }, { data: variants }] = await Promise.all([
      itemIds.length
        ? supabase
            .from("order_item_materials")
            .select("order_item_id,material_id,quantity")
            .in("order_item_id", itemIds)
        : Promise.resolve({
            data: [] as { order_item_id: string; material_id: string; quantity: number }[],
          }),
      productIds.length
        ? supabase
            .from("product_materials")
            .select("product_id,material_id,quantity")
            .in("product_id", productIds)
        : Promise.resolve({
            data: [] as { product_id: string; material_id: string; quantity: number }[],
          }),
      variantIds.length
        ? supabase.from("product_variants").select("id,units").in("id", variantIds)
        : Promise.resolve({ data: [] as { id: string; units: number }[] }),
    ]);
    const units = new Map((variants ?? []).map((v) => [v.id, n(v.units) || 1]));
    for (const item of itemList) {
      const mult = n(item.quantity) * (item.variant_id ? (units.get(item.variant_id) ?? 1) : 1);
      const own = (overrides ?? []).filter((o) => o.order_item_id === item.id);
      const rows = own.length
        ? own.map((o) => ({ material_id: o.material_id, quantity: o.quantity }))
        : (links ?? []).filter((l) => l.product_id === item.product_id);
      for (const row of rows)
        needed.set(row.material_id, (needed.get(row.material_id) ?? 0) + n(row.quantity) * mult);
    }
  }
  const out: ShoppingRow[] = [];
  for (const m of materials) {
    const onHand = n(m.quantity_on_hand);
    const minimum = n(m.minimum_stock);
    const need = needed.get(m.id) ?? 0;
    const toBuy = Math.max(need + minimum - onHand, 0);
    if (toBuy <= 0) continue;
    out.push({
      material_id: m.id,
      name: m.name,
      unit: m.unit,
      color_name: m.color_name ?? null,
      on_hand: onHand,
      minimum,
      needed: need,
      to_buy: toBuy,
      estimated_cost: toBuy * n(m.average_cost),
    });
  }
  return out.sort((a, b) => b.estimated_cost - a.estimated_cost);
}
