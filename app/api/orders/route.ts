import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { calcOrderFeeAndGross } from "@/lib/order-fees";

type OrderMaterialInput = { material_id: string; quantity: number; usage_type?: string };
type OrderItemInput = {
  product_id: string;
  quantity?: number;
  unit_price?: number;
  materials?: OrderMaterialInput[];
};

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
        // Materiais realmente consumidos nesta venda (pode ser diferente do padrão do
        // produto — ex.: mesma peça, cor de filamento diferente). Não entram na tabela
        // order_items; são salvos à parte depois que o item existir, ver abaixo.
        _materials: (i.materials ?? []).filter((m) => m?.material_id && Number(m.quantity) > 0),
      };
    });
    const subtotal = items.reduce((s, i) => s + i.total, 0);
    const discount = Math.max(Number(body.discount || 0), 0);
    const merchandiseTotal = Math.max(subtotal - discount, 0);
    const shipping = Math.max(Number(body.shipping_cost || 0), 0);
    // Taxa extra de campanha/cupom informada manualmente para este pedido específico —
    // não faz parte da configuração do canal porque varia venda a venda.
    const campaignFee = Math.max(Number(body.campaign_fee || 0), 0);
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
    const feeMode = body.fee_mode === "subtract" ? "subtract" : "add";
    const { feePercent, fixedFee, marketplaceFee, grossTotal } = calcOrderFeeAndGross({
      channel,
      merchandiseTotal,
      shipping,
      campaignFee,
      feeMode,
    });
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
    // Insere item a item (não em lote) para garantir que cada order_item_materials
    // seja associado ao id certo — uma inserção em lote não garante a ordem de volta
    // das linhas, e aqui isso decidiria qual variação de material vai para qual item.
    const materialRows: {
      organization_id: string;
      order_item_id: string;
      material_id: string;
      quantity: number;
      usage_type: string;
    }[] = [];
    for (const { _materials, ...i } of items) {
      const { data: row, error: ie } = await supabase
        .from("order_items")
        .insert({ ...i, order_id: order.id })
        .select("id")
        .single();
      if (ie) throw ie;
      for (const m of _materials) {
        materialRows.push({
          organization_id: organizationId,
          order_item_id: row.id,
          material_id: m.material_id,
          quantity: Number(m.quantity),
          usage_type:
            m.usage_type && ["fdm", "resin", "other"].includes(m.usage_type)
              ? m.usage_type
              : "other",
        });
      }
    }
    // Salva os materiais realmente usados em cada item (padrão do produto ou trocado
    // por uma variação de cor nesta venda). O gatilho de consumo de estoque usa isso
    // quando presente, e só cai no padrão do produto se não houver nada aqui.
    if (materialRows.length) {
      const { error: ime } = await supabase.from("order_item_materials").insert(materialRows);
      if (ime) throw ime;
    }
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
    // O gatilho que baixa material do estoque (consume_production_materials) só
    // dispara em UPDATE de status, nunca em INSERT — se a linha já nascesse com
    // status "in_progress", o consumo automático nunca rodaria. Por isso sempre
    // insere como "pending" e, quando o pedido já nasce em produção/concluído, faz um
    // UPDATE logo em seguida para essa mesma transição passar pelo gatilho de verdade.
    const { data: prodOrder, error: pr } = await supabase
      .from("production_orders")
      .insert({
        organization_id: organizationId,
        order_id: order.id,
        status: "pending",
      })
      .select("id")
      .single();
    if (pr) throw pr;
    if (productionStatus !== "pending") {
      const { error: pu } = await supabase
        .from("production_orders")
        .update({
          status: productionStatus,
          started_at: status === "production" ? new Date().toISOString() : null,
          completed_at: ["shipped", "delivered", "cancelled"].includes(status)
            ? completedAt || new Date().toISOString()
            : null,
        })
        .eq("id", prodOrder.id);
      if (pu) throw pu;
    }
    return NextResponse.json(order);
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e, "Erro interno") }, { status: 500 });
  }
}
