import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { calcOrderFeeAndGross } from "@/lib/order-fees";

type ImportItem = { product_id: string; quantity: number; unit_price: number };
type ImportOrder = {
  external_order_id: string | null;
  order_date: string | null;
  shipping_cost?: number;
  campaign_fee?: number;
  items: ImportItem[];
};

export async function POST(request: Request) {
  const { supabase, organizationId } = await requireUser();
  try {
    const body = await request.json();
    const orders = (body.orders ?? []) as ImportOrder[];
    if (!orders.length)
      return NextResponse.json({ error: "Nenhum pedido para importar." }, { status: 400 });
    if (orders.length > 500)
      return NextResponse.json(
        { error: "Máximo de 500 pedidos por importação. Divida o arquivo em partes menores." },
        { status: 400 }
      );

    const feeMode = body.fee_mode === "add" ? "add" : "subtract";
    const markAsDelivered = body.mark_as_delivered !== false;

    let channel: {
      fee_percent: number;
      fixed_fee: number;
      fee_bands: unknown;
      active: boolean;
    } | null = null;
    if (body.sales_channel_id) {
      const { data, error: ce } = await supabase
        .from("sales_channels")
        .select("fee_percent,fixed_fee,fee_bands,active")
        .eq("id", body.sales_channel_id)
        .eq("organization_id", organizationId)
        .single();
      if (ce) throw ce;
      if (!data?.active) throw new Error("O canal selecionado está inativo.");
      channel = data;
    }

    const productIds = [...new Set(orders.flatMap((o) => o.items.map((i) => i.product_id)))];
    const { data: products, error: pe } = await supabase
      .from("products")
      .select("id,name,estimated_cost")
      .eq("organization_id", organizationId)
      .in("id", productIds);
    if (pe) throw pe;
    const productMap = new Map((products ?? []).map((p) => [p.id, p]));

    let created = 0,
      duplicates = 0;
    const errors: { external_order_id: string | null; reason: string }[] = [];

    for (const group of orders) {
      try {
        if (!group.items?.length) {
          errors.push({ external_order_id: group.external_order_id, reason: "Sem itens." });
          continue;
        }
        if (group.external_order_id) {
          const { data: existing } = await supabase
            .from("orders")
            .select("id")
            .eq("organization_id", organizationId)
            .eq("external_order_id", group.external_order_id)
            .maybeSingle();
          if (existing) {
            duplicates++;
            continue;
          }
        }
        const items = group.items.map((i) => {
          const p = productMap.get(i.product_id);
          if (!p) throw new Error(`Produto não encontrado (id ${i.product_id}).`);
          const q = Math.max(Number(i.quantity || 1), 1);
          const unitPrice = Math.max(Number(i.unit_price || 0), 0);
          return {
            product_id: p.id,
            product_name: p.name,
            quantity: q,
            unit_price: unitPrice,
            unit_cost: Number(p.estimated_cost),
            discount: 0,
            total: unitPrice * q,
          };
        });
        const merchandiseTotal = items.reduce((s, i) => s + i.total, 0);
        const shipping = Math.max(Number(group.shipping_cost || 0), 0);
        const campaignFee = Math.max(Number(group.campaign_fee || 0), 0);
        const { feePercent, fixedFee, marketplaceFee, grossTotal } = calcOrderFeeAndGross({
          channel,
          merchandiseTotal,
          shipping,
          campaignFee,
          feeMode,
        });
        const orderDate = group.order_date || new Date().toISOString();
        const status = markAsDelivered ? "delivered" : "new";
        const { data: order, error: oe } = await supabase
          .from("orders")
          .insert({
            organization_id: organizationId,
            sales_channel_id: body.sales_channel_id || null,
            external_order_id: group.external_order_id,
            status,
            payment_status: markAsDelivered ? "paid" : "pending",
            order_date: orderDate,
            completed_at: markAsDelivered ? orderDate : null,
            delivered_at: markAsDelivered ? orderDate : null,
            subtotal: merchandiseTotal,
            discount: 0,
            shipping_cost: shipping,
            marketplace_fee: marketplaceFee,
            marketplace_fee_percent: feePercent,
            marketplace_fixed_fee: fixedFee,
            gross_total: grossTotal,
            total: grossTotal,
          })
          .select("id")
          .single();
        if (oe) throw oe;
        const { error: ie } = await supabase
          .from("order_items")
          .insert(items.map((i) => ({ ...i, order_id: order.id })));
        if (ie) throw ie;
        await supabase.from("order_status_history").insert({
          order_id: order.id,
          new_status: status,
        });
        await supabase.from("production_orders").insert({
          organization_id: organizationId,
          order_id: order.id,
          status: markAsDelivered ? "completed" : "pending",
          completed_at: markAsDelivered ? orderDate : null,
        });
        created++;
      } catch (err) {
        errors.push({
          external_order_id: group.external_order_id,
          reason: errorMessage(err, "Erro ao importar este pedido."),
        });
      }
    }

    return NextResponse.json({ created, duplicates, errors });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e, "Erro interno") }, { status: 500 });
  }
}
