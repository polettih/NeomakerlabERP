import { createClient } from "@/lib/supabase/server";
export async function getDashboard() {
  const supabase = await createClient();
  const [
    { data: orders },
    { data: payments },
    { data: expenses },
    { data: production },
    { data: items },
  ] = await Promise.all([
    supabase.from("orders").select("id,status,total,shipping_cost,marketplace_fee,order_date"),
    supabase.from("payments").select("order_id,amount,payment_date"),
    supabase.from("expenses").select("amount,status"),
    supabase.from("production_orders").select("id,status"),
    supabase
      .from("order_items")
      .select("order_id,quantity,unit_price,unit_cost,total,products(category)"),
  ]);
  const valid = (orders ?? []).filter((o) => o.status !== "cancelled");
  const ids = new Set(valid.map((o) => o.id));
  const paid = new Map<string, number>();
  (payments ?? []).forEach((p) => {
    if (p.order_id && ids.has(p.order_id))
      paid.set(p.order_id, (paid.get(p.order_id) || 0) + Number(p.amount || 0));
  });
  const cats: any = {};
  (items ?? [])
    .filter((i: any) => ids.has(i.order_id))
    .forEach((i: any) => {
      const c = i.products?.category || "Outros";
      cats[c] ??= { category: c, qty: 0, sales: 0, cost: 0, received: 0, fees: 0, shipping: 0 };
      cats[c].qty += Number(i.quantity || 0);
      cats[c].sales += Number(i.total || Number(i.unit_price || 0) * Number(i.quantity || 0));
      cats[c].cost += Number(i.unit_cost || 0) * Number(i.quantity || 0);
    });
  valid.forEach((o) => {
    const orderItems = (items ?? []).filter((i: any) => i.order_id === o.id);
    const base =
      orderItems.reduce(
        (s: number, i: any) =>
          s + Number(i.total || Number(i.unit_price || 0) * Number(i.quantity || 0)),
        0
      ) || Number(o.total || 0);
    orderItems.forEach((i: any) => {
      const c = i.products?.category || "Outros";
      const part = Number(i.total || Number(i.unit_price || 0) * Number(i.quantity || 0)) / base;
      cats[c].fees += Number(o.marketplace_fee || 0) * part;
      cats[c].shipping += Number(o.shipping_cost || 0) * part;
      cats[c].received += (paid.get(o.id) || 0) * part;
    });
  });
  const categories = Object.values(cats)
    .map((r: any) => ({
      ...r,
      profit: r.sales - r.cost - r.fees - r.shipping,
      receivable: Math.max(r.sales - r.received, 0),
    }))
    .sort((a: any, b: any) => b.sales - a.sales);
  const sales = categories.reduce((s: any, r: any) => s + r.sales, 0);
  const received = categories.reduce((s: any, r: any) => s + r.received, 0);
  const costs = (expenses ?? [])
    .filter((e) => e.status !== "cancelled")
    .reduce((s, e) => s + Number(e.amount || 0), 0);
  const profit = categories.reduce((s: any, r: any) => s + r.profit, 0);
  return {
    sales,
    received,
    receivable: Math.max(sales - received, 0),
    costs,
    profit,
    itemsSold: categories.reduce((s: any, r: any) => s + r.qty, 0),
    orders: orders ?? [],
    production: production ?? [],
    categories,
  };
}
