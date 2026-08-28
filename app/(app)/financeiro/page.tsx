import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { FinanceTabs } from "@/components/finance-tabs";
import { FinancialHistory } from "@/components/financial-history";
import { RecurringExpensesManager } from "@/components/recurring-expenses-manager";
import { MonthlySummary } from "@/components/monthly-summary";
import { PageTabs } from "@/components/page-tabs";
import { ensureRecurringExpensesForCurrentMonth } from "@/lib/services/recurring-expenses";
import { getFinanceSummary } from "@/lib/services/finance-summary";
import { signedMoney as money } from "@/lib/format";
import type { FinanceHistoryRow } from "@/lib/types";

function toMonth(row: FinanceHistoryRow) {
  return {
    label: row.label,
    gross: row.gross,
    received: row.received,
    expensesPaid: row.outflow,
    result: row.cashResult,
  };
}

export default async function FinanceiroPage() {
  const { supabase, organizationId } = await requireUser();

  // Gera as despesas recorrentes do mês corrente (aluguel, assinaturas etc.) antes de
  // carregar os dados, para que já apareçam nesta mesma visita.
  await ensureRecurringExpensesForCurrentMonth(supabase, organizationId);

  // Mesma fonte de dados usada pelo Início — "Vendas", "Lucro" e "Despesas" aqui são,
  // por construção, idênticos aos números mostrados lá. Ver lib/services/finance-summary.ts.
  const { totals, categories, historyRows, laborHourRate, recurringExpenses } =
    await getFinanceSummary(supabase, organizationId);

  const currentRow = historyRows[historyRows.length - 1];
  const previousRow = historyRows.length > 1 ? historyRows[historyRows.length - 2] : null;
  const currentMonth = toMonth(currentRow);
  const previousMonth = previousRow ? toMonth(previousRow) : null;

  return (
    <div className="content">
      <div className="section-title">
        <div>
          <h1>Financeiro</h1>
          <p className="muted">
            Controle de caixa, resultado, dívidas, recebimentos e evolução financeira desde o início
            da operação.
          </p>
        </div>
        <Link className="btn btn-secondary" href="/gastos-e-compras">
          Lançar gastos e compras →
        </Link>
      </div>

      <MonthlySummary current={currentMonth} previous={previousMonth} />

      <div className="grid four-col" style={{ marginTop: 18 }}>
        <div className="card">
          <span className="muted">Vendas</span>
          <h2>{money(totals.merchandise)}</h2>
          <small className="muted">Receita de mercadoria, mesmo número do Início</small>
        </div>
        <div className="card">
          <span className="muted">Caixa disponível acumulado</span>
          <h2 className={totals.cashBalance < 0 ? "error" : ""}>{money(totals.cashBalance)}</h2>
          <small className="muted">Recebido − saídas pagas</small>
        </div>
        <div className="card">
          <span className="muted">A receber</span>
          <h2>{money(totals.receivable)}</h2>
          <small className="muted">Inclui taxas e frete já cobrados do cliente</small>
        </div>
        <div className="card">
          <span className="muted">Contas a pagar</span>
          <h2 className={totals.payable > 0 ? "error" : ""}>
            {totals.payable > 0 ? money(-totals.payable) : money(0)}
          </h2>
          {totals.overduePayable > 0 ? (
            <small className="error">⚠ {money(-totals.overduePayable)} vencidas</small>
          ) : (
            <small className="muted">Obrigações em aberto</small>
          )}
        </div>
      </div>

      <div className="grid four-col" style={{ marginTop: 12 }}>
        <div className="card">
          <span className="muted">Saídas acumuladas</span>
          <h2>{money(totals.totalCashOut)}</h2>
          <small className="muted">Compras + despesas pagas + equipamentos</small>
        </div>
        <div className="card">
          <span className="muted">Lucro líquido</span>
          <h2 className={totals.profit < 0 ? "error" : ""}>{money(totals.profit)}</h2>
          <small className="muted">Vendas − custo − taxas − frete − mão de obra</small>
        </div>
        <div className="card">
          <span className="muted">Recuperação do caixa</span>
          <h2>{totals.recovery.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</h2>
          <small className="muted">Recebimentos ÷ saídas acumuladas</small>
        </div>
        <div className="card">
          <span className="muted">Taxas de marketplace</span>
          <h2>{money(totals.fees)}</h2>
          <small className="muted">{totals.feeOrderCount} pedidos com taxa</small>
        </div>
      </div>

      <PageTabs
        defaultTab="categorias"
        tabs={[
          {
            id: "categorias",
            label: "Por categoria e canal",
            content: (
              <FinanceTabs
                summary={{
                  qty: totals.qty,
                  gross: totals.merchandise,
                  received: totals.received,
                  receivable: totals.receivable,
                  profit: totals.profit,
                }}
                rows={categories}
                fees={{ total: totals.fees, count: totals.feeOrderCount }}
                labor={{ total: totals.labor, items: totals.laborItemCount }}
                spent={totals.paidExpenses}
                initialLaborHourRate={laborHourRate}
              />
            ),
          },
          {
            id: "historico",
            label: "Histórico mensal",
            content: (
              <FinancialHistory
                rows={historyRows}
                totalPayable={totals.payable}
                totalReceivable={totals.receivable}
                totalOutflow={totals.totalCashOut}
                totalGross={totals.billed}
                totalReceived={totals.received}
              />
            ),
          },
          {
            id: "recorrentes",
            label: "Despesas recorrentes",
            content: <RecurringExpensesManager items={recurringExpenses} />,
          },
        ]}
      />
    </div>
  );
}
