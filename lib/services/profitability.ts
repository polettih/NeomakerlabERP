import type { SupabaseClient } from "@supabase/supabase-js";
import { isCancelledStatus, n } from "@/lib/format";

export type ProfitRow = {
  label: string;
  qty: number;
  revenue: number;
  cost: number;
  fees: number;
  shipping: number;
  profit: number;
  /** Lucro ÷ receita, em %. */
  margin: number;
};

type OrderRow = {
  id: string;
  status: string;
  subtotal: number | string | null;
  marketplace_fee: number | string | null;
  shipping_cost: number | string | null;
  sales_channels: { name: string }[] | { name: string } | null;
};
type ItemRow = {
  order_id: string;
  product_name: string;
  variant_name: string | null;
  quantity: number | string;
  unit_cost: number | string | null;
  total: number | string | null;
};

const channelName = (c: OrderRow["sales_channels"]) =>
  (Array.isArray(c) ? c[0]?.name : c?.name) || "Sem canal";

function finish(map: Map<string, Omit<ProfitRow, "profit" | "margin">>): ProfitRow[] {
  return [...map.values()]
    .map((r) => {
      const profit = r.revenue - r.cost - r.fees - r.shipping;
      return { ...r, profit, margin: r.revenue > 0 ? (profit / r.revenue) * 100 : 0 };
    })
    .sort((a, b) => b.profit - a.profit);
}

/**
 * Lucratividade por produto/variação e por canal de venda. Pedidos cancelados ficam de fora.
 * A taxa do marketplace e o frete de cada pedido são rateados entre os itens pelo valor
 * vendido, então a soma bate com o lucro dos pedidos (antes da mão de obra, que só existe
 * no nível do produto, não do pedido).
 */
export async function getProfitability(supabase: SupabaseClient, organizationId: string) {
  const { data: orders } = await supabase
    .from("orders")
    .select("id,status,subtotal,marketplace_fee,shipping_cost,sales_channels(name)")
    .eq("organization_id", organizationId)
    .range(0, 4999);
  const valid = ((orders ?? []) as OrderRow[]).filter((o) => !isCancelledStatus(o.status));
  const ids = valid.map((o) => o.id);
  const items: ItemRow[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase
      .from("order_items")
      .select("order_id,product_name,variant_name,quantity,unit_cost,total")
      .in("order_id", ids.slice(i, i + 200));
    items.push(...((data ?? []) as ItemRow[]));
  }
  const orderById = new Map(valid.map((o) => [o.id, o]));
  const itemsByOrder = new Map<string, ItemRow[]>();
  for (const it of items) {
    const list = itemsByOrder.get(it.order_id) ?? [];
    list.push(it);
    itemsByOrder.set(it.order_id, list);
  }
  const products = new Map<string, Omit<ProfitRow, "profit" | "margin">>();
  const channels = new Map<string, Omit<ProfitRow, "profit" | "margin">>();
  const add = (
    map: typeof products,
    key: string,
    label: string,
    v: { qty: number; revenue: number; cost: number; fees: number; shipping: number }
  ) => {
    const cur = map.get(key) ?? { label, qty: 0, revenue: 0, cost: 0, fees: 0, shipping: 0 };
    cur.qty += v.qty;
    cur.revenue += v.revenue;
    cur.cost += v.cost;
    cur.fees += v.fees;
    cur.shipping += v.shipping;
    map.set(key, cur);
  };
  for (const [orderId, list] of itemsByOrder) {
    const o = orderById.get(orderId);
    if (!o) continue;
    const orderRevenue = list.reduce((s, i) => s + n(i.total), 0);
    for (const it of list) {
      const revenue = n(it.total);
      const share = orderRevenue > 0 ? revenue / orderRevenue : 1 / list.length;
      const v = {
        qty: n(it.quantity),
        revenue,
        cost: n(it.unit_cost) * n(it.quantity),
        fees: n(o.marketplace_fee) * share,
        shipping: n(o.shipping_cost) * share,
      };
      // product_name já vem como "Produto — Variação" nos pedidos com variação.
      add(products, it.product_name, it.product_name, v);
      add(channels, channelName(o.sales_channels), channelName(o.sales_channels), v);
    }
  }
  return { products: finish(products), channels: finish(channels) };
}
