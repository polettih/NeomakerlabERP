import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";

type OrderItemInput = { product_id: string; quantity?: number };

export async function POST(request: Request) {
  const { supabase, organizationId } = await requireUser();
  try {
    const body = await request.json();
    if (!body.items?.length)
      return NextResponse.json({ error: "Adicione pelo menos um produto." }, { status: 400 });
    const ids = (body.items as OrderItemInput[]).map((i) => i.product_id);
    const { data: products, error: pe } = await supabase
      .from("products")
      .select("id,name,sale_price,estimated_cost")
      .eq("organization_id", organizationId)
      .in("id", ids);
    if (pe) throw pe;
    const items = (body.items as OrderItemInput[]).map((i) => {
      const p = products?.find((x) => x.id === i.product_id);
      if (!p) throw new Error("Produto inválido.");
      const q = Math.max(Number(i.quantity || 1), 1);
      return {
        product_id: p.id,
        product_name: p.name,
        quantity: q,
        unit_price: Number(p.sale_price),
        unit_cost: Number(p.estimated_cost),
        discount: 0,
        total: Number(p.sale_price) * q,
      };
    });
    const subtotal = items.reduce((s, i) => s + i.total, 0);
    const discount = Math.max(Number(body.discount || 0), 0);
    const merchandiseTotal = Math.max(subtotal - discount, 0);
    const shipping = Math.max(Number(body.shipping_cost || 0), 0);
    let feePercent = 0;
    let fixedFee = 0;
    if (body.sales_channel_id) {
      const { data: channel, error: ce } = await supabase
        .from("sales_channels")
        .select("fee_percent,fixed_fee,active")
        .eq("id", body.sales_channel_id)
        .eq("organization_id", organizationId)
        .single();
      if (ce) throw ce;
      if (!channel?.active) throw new Error("O canal selecionado está inativo.");
      feePercent = Number(channel.fee_percent || 0);
      fixedFee = Number(channel.fixed_fee || 0);
    }
    const marketplaceFee = Math.max(merchandiseTotal * feePercent + fixedFee, 0);
    const grossTotal = Math.max(merchandiseTotal + marketplaceFee + shipping, 0);
    const status = body.status || "new";
    const allowed = [
      "new",
      "preparation",
      "production",
      "finishing",
      "packaging",
      "shipped",
      "delivered",
      "cancelled",
    ];
    if (!allowed.includes(status))
      return NextResponse.json({ error: "Status inválido." }, { status: 400 });
    const completedAt =
      status === "delivered" ? body.completed_at || new Date().toISOString() : null;
    const { data: order, error: oe } = await supabase
      .from("orders")
      .insert({
        organization_id: organizationId,
        customer_id: body.customer_id || null,
        sales_channel_id: body.sales_channel_id || null,
        status,
        payment_status: body.payment_status || "pending",
        order_date: body.order_date || new Date().toISOString(),
        expected_date: body.expected_date || null,
        completed_at: completedAt,
        delivered_at: status === "delivered" ? completedAt : null,
        subtotal,
        discount,
        shipping_cost: shipping,
        marketplace_fee: marketplaceFee,
        marketplace_fee_percent: feePercent,
        marketplace_fixed_fee: fixedFee,
        gross_total: grossTotal,
        total: grossTotal,
      })
      .select()
      .single();
    if (oe) throw oe;
    const { error: ie } = await supabase
      .from("order_items")
      .insert(items.map((i) => ({ ...i, order_id: order.id })));
    if (ie) throw ie;
    const { error: he } = await supabase
      .from("order_status_history")
      .insert({ order_id: order.id, new_status: status });
    if (he) throw he;
    const productionStatus =
      status === "cancelled"
        ? "cancelled"
        : ["shipped", "delivered"].includes(status)
          ? "completed"
          : status === "production"
            ? "in_progress"
            : "pending";
    const { error: pr } = await supabase.from("production_orders").insert({
      organization_id: organizationId,
      order_id: order.id,
      status: productionStatus,
      started_at: status === "production" ? new Date().toISOString() : null,
      completed_at: ["shipped", "delivered", "cancelled"].includes(status)
        ? completedAt || new Date().toISOString()
        : null,
    });
    if (pr) throw pr;
    return NextResponse.json(order);
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e, "Erro interno") }, { status: 500 });
  }
}
