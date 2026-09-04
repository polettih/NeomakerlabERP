import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { resolveFeeBand, type FeeBand } from "@/lib/fee-bands";

type OrderItemInput = { product_id: string; quantity?: number; unit_price?: number };

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
      // Preço unitário desta venda: por padrão é o preço cadastrado no produto, mas o
      // formulário permite sobrescrever para refletir o valor real cobrado no anúncio
      // (Shopee, TikTok Shop, promoções variam por pedido). O custo (unit_cost) segue
      // vindo do produto normalmente — só o preço de venda muda por pedido.
      const rawUnitPrice = Number(i.unit_price);
      const unitPrice =
        Number.isFinite(rawUnitPrice) && rawUnitPrice > 0 ? rawUnitPrice : Number(p.sale_price);
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
    const subtotal = items.reduce((s, i) => s + i.total, 0);
    const discount = Math.max(Number(body.discount || 0), 0);
    const merchandiseTotal = Math.max(subtotal - discount, 0);
    const shipping = Math.max(Number(body.shipping_cost || 0), 0);
    // Taxa extra de campanha/cupom informada manualmente para este pedido específico —
    // não faz parte da configuração do canal porque varia venda a venda.
    const campaignFee = Math.max(Number(body.campaign_fee || 0), 0);
    let feePercent = 0;
    let fixedFee = 0;
    if (body.sales_channel_id) {
      const { data: channel, error: ce } = await supabase
        .from("sales_channels")
        .select("fee_percent,fixed_fee,fee_bands,active")
        .eq("id", body.sales_channel_id)
        .eq("organization_id", organizationId)
        .single();
      if (ce) throw ce;
      if (!channel?.active) throw new Error("O canal selecionado está inativo.");
      const bands = (channel.fee_bands ?? []) as FeeBand[];
      // Quando o canal tem faixas de preço cadastradas (ex.: Shopee), a taxa é
      // escolhida automaticamente pelo valor da mercadoria deste pedido — em
      // vez de depender de o lojista lembrar de escolher o canal certo.
      const band = resolveFeeBand(bands, merchandiseTotal);
      if (band) {
        feePercent = band.fee_percent;
        fixedFee = band.fixed_fee;
      } else {
        feePercent = Number(channel.fee_percent || 0);
        fixedFee = Number(channel.fixed_fee || 0);
      }
    }
    const marketplaceFee = Math.max(merchandiseTotal * feePercent + fixedFee + campaignFee, 0);
    // "add" (padrão): a taxa soma ao valor cobrado do cliente — o alvo de recebimento
    // (gross_total, usado em "A receber") inclui a taxa.
    // "subtract": o valor informado já é o preço do anúncio (Shopee/TikTok Shop); o
    // marketplace desconta a taxa ANTES de repassar o dinheiro, então o alvo de
    // recebimento precisa ser o valor líquido — senão "A receber" nunca zeraria mesmo
    // com o pagamento completo registrado.
    const feeMode = body.fee_mode === "subtract" ? "subtract" : "add";
    const grossTotal =
      feeMode === "add"
        ? Math.max(merchandiseTotal + marketplaceFee + shipping, 0)
        : Math.max(merchandiseTotal - marketplaceFee, 0) + shipping;
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
