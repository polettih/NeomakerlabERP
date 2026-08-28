import type { SupabaseClient } from "@supabase/supabase-js";
import { n, validDate, monthKey, monthLabel, isPaidStatus, isCancelledStatus } from "@/lib/format";
import type { Expense, FinanceCategoryRow, FinanceHistoryRow } from "@/lib/types";

/**
 * Fonte única de verdade para todos os números financeiros do sistema.
 *
 * Antes desta função, o Início (lib/services/dashboard.ts) e o Financeiro
 * (app/(app)/financeiro/page.tsx) recalculavam "vendas", "lucro" e "despesas"
 * cada um com sua própria fórmula, e as fórmulas haviam divergido:
 *
 *  - Início somava apenas o valor da mercadoria como "Vendas".
 *  - Financeiro somava `gross_total` (mercadoria + taxa de marketplace + frete)
 *    e chamava isso de "Faturamento" — um número maior, mas na prática é o
 *    total COBRADO do cliente, não a receita da empresa (taxa e frete são
 *    repassados a terceiros).
 *  - O "lucro" do Financeiro nunca descontava o frete, mesmo somando-o na
 *    receita — inflando o resultado exatamente pelo total de fretes do período.
 *
 * Esta função resolve isso separando os dois conceitos explicitamente:
 *
 *  - `merchandise` (Vendas/Receita): preço × quantidade dos itens vendidos.
 *    É a receita real da empresa e a base de todo cálculo de lucro.
 *  - `billed` (Total faturado ao cliente): merchandise + taxa + frete. É
 *    quanto o cliente deve pagar no total — usado só para caixa/recebíveis
 *    (quanto falta receber), nunca para calcular lucro.
 *
 * Lucro = merchandise − custo do produto − taxa de marketplace − frete − mão de obra.
 * Essa é a única fórmula de lucro do sistema; todas as telas consomem este resultado.
 */
export async function getFinanceSummary(supabase: SupabaseClient, organizationId: string) {
  const [
    { data: orders },
    { data: items },
    { data: payments },
    { data: expenses },
    { data: materialPurchases },
    { data: settings },
    { data: recurringExpenses },
    { data: production },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id,status,total,gross_total,shipping_cost,marketplace_fee,order_date,expected_date,completed_at"
      ),
    supabase
      .from("order_items")
      .select(
        "order_id,product_name,quantity,unit_price,unit_cost,total,products(category),product_id"
      ),
    supabase.from("payments").select("order_id,amount,payment_date"),
    supabase
      .from("expenses")
      .select(
        "id,description,category,amount,status,due_date,paid_at,created_at,source_type,source_id"
      )
      .order("due_date", { ascending: false, nullsFirst: false }),
    supabase.from("material_purchases").select("id,total_cost,created_at"),
    supabase
      .from("organization_settings")
      .select("labor_hour_rate")
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase
      .from("recurring_expenses")
      .select("id,description,category,amount,day_of_month,active")
      .order("created_at", { ascending: true }),
    supabase.from("production_orders").select("id,status"),
  ]);

  const validOrders = (orders ?? []).filter((o) => !isCancelledStatus(o.status));
  const validIds = new Set(validOrders.map((o) => o.id));
  const validExpenses = ((expenses ?? []) as Expense[]).filter((e) => !isCancelledStatus(e.status));

  const paymentsByOrder = new Map<string, number>();
  for (const p of payments ?? [])
    if (p.order_id && validIds.has(p.order_id))
      paymentsByOrder.set(p.order_id, (paymentsByOrder.get(p.order_id) ?? 0) + n(p.amount));

  const productIds = [
    ...new Set((items ?? []).map((i) => i.product_id).filter((id): id is string => Boolean(id))),
  ];
  const laborCostByProduct = new Map<string, number>();
  if (productIds.length) {
    const { data } = await supabase
      .from("product_pricing")
      .select("product_id,labor_cost")
      .in("product_id", productIds);
    for (const p of data ?? []) laborCostByProduct.set(p.product_id, n(p.labor_cost));
  }

  const rowsMap: Record<string, FinanceCategoryRow> = {};
  let totalMerchandise = 0,
    totalBilled = 0,
    totalReceived = 0,
    totalCost = 0,
    totalFees = 0,
    totalShipping = 0,
    totalLabor = 0,
    totalQty = 0,
    totalLaborItems = 0;

  for (const order of validOrders) {
    const orderItems = (items ?? []).filter((i) => i.order_id === order.id);
    const merchandise = orderItems.reduce(
      (s, i) => s + (n(i.total) || n(i.unit_price) * n(i.quantity)),
      0
    );
    const billed = n(order.gross_total ?? order.total);
    const fee = n(order.marketplace_fee);
    const shipping = n(order.shipping_cost);
    const received = paymentsByOrder.get(order.id) ?? 0;

    totalMerchandise += merchandise;
    totalBilled += billed;
    totalFees += fee;
    totalShipping += shipping;
    totalReceived += received;

    for (const item of orderItems) {
      const product = Array.isArray(item.products) ? item.products[0] : item.products;
      const category = product?.category || "Outros";
      const qty = n(item.quantity);
      const base = n(item.total) || n(item.unit_price) * qty;
      const share = merchandise > 0 ? base / merchandise : 0;
      const row =
        rowsMap[category] ??
        (rowsMap[category] = {
          category,
          qty: 0,
          merchandise: 0,
          billed: 0,
          received: 0,
          receivable: 0,
          cost: 0,
          fees: 0,
          shipping: 0,
          labor: 0,
        });
      const laborPerUnit = item.product_id ? (laborCostByProduct.get(item.product_id) ?? 0) : 0;
      row.qty += qty;
      row.merchandise += base;
      row.billed += billed * share;
      row.received += received * share;
      row.cost += n(item.unit_cost) * qty;
      row.fees += fee * share;
      row.shipping += shipping * share;
      row.labor += laborPerUnit * qty;
      totalCost += n(item.unit_cost) * qty;
      totalLabor += laborPerUnit * qty;
      totalQty += qty;
      if (laborPerUnit > 0) totalLaborItems += qty;
    }
  }

  const categories = Object.values(rowsMap)
    .map((row) => ({ ...row, receivable: Math.max(row.billed - row.received, 0) }))
    .sort((a, b) => b.merchandise - a.merchandise);

  const materialPurchasesTotal = (materialPurchases ?? []).reduce((s, p) => s + n(p.total_cost), 0);
  // Despesas administrativas pagas: aluguel, marketing, assinaturas etc. Exclui compra de
  // material (já embutida no custo do produto vendido, via unit_cost) e compra de
  // equipamento (investimento/capex, não despesa operacional recorrente) — somar qualquer
  // uma delas aqui contaria o mesmo custo duas vezes no lucro.
  const paidExpenses = validExpenses
    .filter((e) => isPaidStatus(e.status) && e.source_type !== "machine_purchase")
    .reduce((s, e) => s + n(e.amount), 0);
  const machineExpensesPaid = validExpenses
    .filter((e) => isPaidStatus(e.status) && e.source_type === "machine_purchase")
    .reduce((s, e) => s + n(e.amount), 0);
  const unpaidExpenses = validExpenses.filter((e) => !isPaidStatus(e.status));
  const payableTotal = unpaidExpenses.reduce((s, e) => s + n(e.amount), 0);
  const today = new Date();
  const overduePayableTotal = unpaidExpenses
    .filter((e) => {
      const due = validDate(e.due_date);
      return due !== null && due < today;
    })
    .reduce((s, e) => s + n(e.amount), 0);

  // Saídas de caixa: tudo que efetivamente saiu do bolso (diferente do lucro, que é
  // apurado por competência). Inclui compra de material e de equipamento porque ambas
  // são desembolso real, mesmo não sendo "despesa operacional" no sentido de resultado.
  const totalCashOut = materialPurchasesTotal + paidExpenses + machineExpensesPaid;
  const cashBalance = totalReceived - totalCashOut;
  const recovery =
    totalCashOut > 0 ? Math.max(0, Math.min(100, (totalReceived / totalCashOut) * 100)) : 100;

  // Única fórmula de lucro do sistema: receita real (mercadoria) menos todos os custos
  // atribuíveis à venda, inclusive o frete (que antes ficava de fora por engano).
  const profit = totalMerchandise - totalCost - totalFees - totalShipping - totalLabor;
  const receivable = Math.max(totalBilled - totalReceived, 0);

  // --- Histórico mensal (visão de caixa, não de competência) ---
  const historyMap = new Map<string, FinanceHistoryRow>();
  const ensure = (key: string) => {
    let row = historyMap.get(key);
    if (!row) {
      row = {
        key,
        label: monthLabel(key),
        gross: 0,
        received: 0,
        receivable: 0,
        purchases: 0,
        expenses: 0,
        equipment: 0,
        outflow: 0,
        cashResult: 0,
        cumulative: 0,
        payable: 0,
      };
      historyMap.set(key, row);
    }
    return row;
  };
  for (const o of validOrders) {
    const k = monthKey(o.order_date);
    if (k) ensure(k).gross += n(o.gross_total ?? o.total);
  }
  for (const p of payments ?? []) {
    if (p.order_id && validIds.has(p.order_id)) {
      const k = monthKey(p.payment_date);
      if (k) ensure(k).received += n(p.amount);
    }
  }
  for (const p of materialPurchases ?? []) {
    const k = monthKey(p.created_at);
    if (k) ensure(k).purchases += n(p.total_cost);
  }
  for (const e of validExpenses) {
    const paid = isPaidStatus(e.status);
    const paymentKey = monthKey(e.paid_at);
    if (paid && paymentKey) {
      const row = ensure(paymentKey);
      if (e.source_type === "machine_purchase") row.equipment += n(e.amount);
      else row.expenses += n(e.amount);
    }
  }

  const keys = [...historyMap.keys()].sort();
  const now = new Date();
  const currentKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const startKey = keys[0] ?? currentKey;
  const allKeys: string[] = [];
  {
    let [y, m] = startKey.split("-").map(Number);
    const [ey, em] = currentKey.split("-").map(Number);
    while (y < ey || (y === ey && m <= em)) {
      allKeys.push(`${y}-${String(m).padStart(2, "0")}`);
      m++;
      if (m === 13) {
        m = 1;
        y++;
      }
    }
  }
  const historyRows = allKeys.map(ensure);

  let cumulative = 0;
  for (const row of historyRows) {
    row.outflow = row.purchases + row.expenses + row.equipment;
    row.cashResult = row.received - row.outflow;
    cumulative += row.cashResult;
    row.cumulative = cumulative;
    const [y, m] = row.key.split("-").map(Number);
    const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
    row.receivable = validOrders.reduce((s, o) => {
      const od = validDate(o.order_date);
      if (!od || od > end) return s;
      const receivedByEnd = (payments ?? [])
        .filter(
          (p) =>
            p.order_id === o.id &&
            validIds.has(o.id) &&
            validDate(p.payment_date) &&
            validDate(p.payment_date)! <= end
        )
        .reduce((a, p) => a + n(p.amount), 0);
      return s + Math.max(n(o.gross_total ?? o.total) - receivedByEnd, 0);
    }, 0);
    row.payable = validExpenses.reduce((s, e) => {
      const created = validDate(e.created_at);
      if (!created || created > end) return s;
      const paid = isPaidStatus(e.status);
      const paidAt = validDate(e.paid_at);
      if (paid && paidAt && paidAt <= end) return s;
      return s + n(e.amount);
    }, 0);
  }

  return {
    totals: {
      qty: totalQty,
      merchandise: totalMerchandise,
      billed: totalBilled,
      received: totalReceived,
      receivable,
      cost: totalCost,
      fees: totalFees,
      feeOrderCount: validOrders.filter((o) => n(o.marketplace_fee) > 0).length,
      shipping: totalShipping,
      labor: totalLabor,
      laborItemCount: totalLaborItems,
      profit,
      materialPurchases: materialPurchasesTotal,
      paidExpenses,
      machineExpensesPaid,
      payable: payableTotal,
      overduePayable: overduePayableTotal,
      totalCashOut,
      cashBalance,
      recovery,
    },
    categories,
    historyRows,
    laborHourRate: n(settings?.labor_hour_rate ?? 30),
    recurringExpenses: recurringExpenses ?? [],
    orders: orders ?? [],
    production: production ?? [],
  };
}

export type FinanceSummary = Awaited<ReturnType<typeof getFinanceSummary>>;
