import { requireUser } from "@/lib/auth";
import { getFinanceSummary } from "@/lib/services/finance-summary";

/**
 * Início consome a mesma função que o Financeiro (getFinanceSummary), garantindo
 * que "Vendas", "Lucro" e "Despesas" nunca mais divirjam entre as duas telas.
 * Antes, este arquivo recalculava tudo com fórmulas próprias — ver histórico do
 * projeto para a análise completa das 3 inconsistências que isso causava.
 */
export async function getDashboard() {
  const { supabase, organizationId } = await requireUser();
  const summary = await getFinanceSummary(supabase, organizationId);

  return {
    // "Vendas" = receita real de mercadoria (mesma definição usada em Financeiro).
    sales: summary.totals.merchandise,
    received: summary.totals.received,
    receivable: summary.totals.receivable,
    // "Despesas" = despesas administrativas pagas (mesma definição de Financeiro):
    // exclui compra de material (já embutida no custo do produto) e compra de
    // equipamento (investimento, não despesa operacional recorrente).
    costs: summary.totals.paidExpenses,
    profit: summary.totals.profit,
    itemsSold: summary.totals.qty,
    orders: summary.orders,
    production: summary.production,
    categories: summary.categories.map((r) => ({
      category: r.category,
      qty: r.qty,
      sales: r.merchandise,
      received: r.received,
      profit: r.merchandise - r.cost - r.fees - r.shipping - r.labor,
      receivable: r.receivable,
    })),
  };
}
