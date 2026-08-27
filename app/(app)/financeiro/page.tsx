import { requireUser } from "@/lib/auth";
import { CreateExpenseForm } from "@/components/create-expense-form";
import { FinanceTabs } from "@/components/finance-tabs";
import { FinancialHistory } from "@/components/financial-history";
import { ExpenseList } from "@/components/expense-list";
import { RecurringExpensesManager } from "@/components/recurring-expenses-manager";
import { MonthlySummary } from "@/components/monthly-summary";
import { ensureRecurringExpensesForCurrentMonth } from "@/lib/services/recurring-expenses";

type Row = {
  category: string;
  qty: number;
  gross: number;
  received: number;
  receivable: number;
  cost: number;
  fees: number;
  labor: number;
};
type Expense = {
  id: string;
  description: string;
  category: string | null;
  amount: unknown;
  status: string | null;
  due_date: string | null;
  paid_at: string | null;
  created_at: string | null;
  source_type: string | null;
  source_id: string | null;
};
type HistoryRow = {
  key: string;
  label: string;
  gross: number;
  received: number;
  receivable: number;
  purchases: number;
  expenses: number;
  equipment: number;
  outflow: number;
  cashResult: number;
  cumulative: number;
  payable: number;
  payableDue: number;
};

const n = (v: unknown) => {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
};
const validDate = (v: unknown) => {
  const d = new Date(String(v ?? ""));
  return Number.isNaN(d.getTime()) ? null : d;
};
const monthKey = (v: unknown) => {
  const d = validDate(v);
  return d ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}` : null;
};
const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, 1)))
    .replace(" de ", "/")
    .replace(".", "");
};
const paidStatus = (status: unknown) =>
  ["paid", "pago", "paid_out"].includes(String(status ?? "").toLowerCase());
const cancelledStatus = (status: unknown) =>
  ["cancelled", "canceled", "cancelado"].includes(String(status ?? "").toLowerCase());
const money = (value: number) => {
  const abs = Math.abs(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return value < 0 ? `R$ - ${abs.replace(/^R\$\s?/, "")}` : abs;
};

function monthRange(start: string, end: string) {
  const result: string[] = [];
  let [y, m] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  while (y < ey || (y === ey && m <= em)) {
    result.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m === 13) {
      m = 1;
      y++;
    }
  }
  return result;
}

export default async function FinanceiroPage() {
  const { supabase, organizationId } = await requireUser();

  // Gera as despesas recorrentes do mês corrente (aluguel, assinaturas etc.) antes de
  // carregar os dados, para que já apareçam nesta mesma visita.
  await ensureRecurringExpensesForCurrentMonth(supabase, organizationId);

  const [
    { data: orders },
    { data: items },
    { data: payments },
    { data: expenses },
    { data: materialPurchases },
    { data: settings },
    { data: recurringExpenses },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("id,status,total,gross_total,shipping_cost,marketplace_fee,order_date"),
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
  ]);

  const validOrders = (orders ?? []).filter((o) => !cancelledStatus(o.status));
  const validIds = new Set(validOrders.map((o) => o.id));
  const validExpenses = ((expenses ?? []) as Expense[]).filter((e) => !cancelledStatus(e.status));

  const paymentsByOrder = new Map<string, number>();
  for (const p of payments ?? [])
    if (p.order_id && validIds.has(p.order_id))
      paymentsByOrder.set(p.order_id, (paymentsByOrder.get(p.order_id) ?? 0) + n(p.amount));

  const productIds = [
    ...new Set((items ?? []).map((i) => i.product_id).filter((id): id is string => Boolean(id))),
  ];
  const pricing = new Map<string, number>();
  if (productIds.length) {
    const { data } = await supabase
      .from("product_pricing")
      .select("product_id,labor_cost")
      .in("product_id", productIds);
    for (const p of data ?? []) pricing.set(p.product_id, n(p.labor_cost));
  }

  const rowsMap: Record<string, Row> = {};
  let totalGross = 0,
    totalReceived = 0,
    totalCost = 0,
    totalFees = 0,
    totalLabor = 0,
    totalQty = 0,
    totalLaborItems = 0;
  for (const order of validOrders) {
    const orderItems = (items ?? []).filter((i) => i.order_id === order.id);
    const merchandise = orderItems.reduce(
      (s, i) => s + (n(i.total) || n(i.unit_price) * n(i.quantity)),
      0
    );
    const gross = n(order.gross_total ?? order.total);
    const fee = n(order.marketplace_fee);
    const received = paymentsByOrder.get(order.id) ?? 0;
    totalGross += gross;
    totalFees += fee;
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
          gross: 0,
          received: 0,
          receivable: 0,
          cost: 0,
          fees: 0,
          labor: 0,
        });
      const laborPerUnit = item.product_id ? (pricing.get(item.product_id) ?? 0) : 0;
      row.qty += qty;
      row.gross += gross * share;
      row.received += received * share;
      row.cost += n(item.unit_cost) * qty;
      row.fees += fee * share;
      row.labor += laborPerUnit * qty;
      totalCost += n(item.unit_cost) * qty;
      totalLabor += laborPerUnit * qty;
      totalQty += qty;
      if (laborPerUnit > 0) totalLaborItems += qty;
    }
  }
  const rows = Object.values(rowsMap).sort((a, b) => b.gross - a.gross);
  for (const row of rows) row.receivable = Math.max(row.gross - row.received, 0);

  const materialPurchasesTotal = (materialPurchases ?? []).reduce((s, p) => s + n(p.total_cost), 0);
  const paidExpenses = validExpenses
    .filter((e) => paidStatus(e.status))
    .reduce((s, e) => s + n(e.amount), 0);
  const unpaidExpenses = validExpenses.filter((e) => !paidStatus(e.status));
  const payableTotal = unpaidExpenses.reduce((s, e) => s + n(e.amount), 0);
  const totalCashOut = materialPurchasesTotal + paidExpenses;
  const cashBalance = totalReceived - totalCashOut;
  const operatingResult = totalGross - totalCost - totalFees - totalLabor;
  const recovery =
    totalCashOut > 0 ? Math.max(0, Math.min(100, (totalReceived / totalCashOut) * 100)) : 100;

  const historyMap = new Map<string, HistoryRow>();
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
        payableDue: 0,
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
    const paid = paidStatus(e.status);
    const paymentKey = monthKey(e.paid_at);
    const createdKey = monthKey(e.created_at);
    const dueKey = monthKey(e.due_date || e.created_at);
    if (paid && paymentKey) {
      const row = ensure(paymentKey);
      if (e.source_type === "machine_purchase") row.equipment += n(e.amount);
      else row.expenses += n(e.amount);
    }
    if (!paid && dueKey) {
      const row = ensure(dueKey);
      row.payableDue += n(e.amount);
    }
    if (!createdKey && !paymentKey && !dueKey) continue;
  }

  // Inclui todos os meses entre a primeira movimentação e o mês atual, mesmo que algum mês não tenha movimento.
  const keys = [...historyMap.keys()].sort();
  const now = new Date();
  const currentKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const startKey = keys[0] ?? currentKey;
  const allKeys = monthRange(startKey, currentKey);
  const historyRows = allKeys.map(ensure);

  // Snapshot mensal: a receber e a pagar são saldos em aberto no fechamento daquele mês.
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
      // O saldo a pagar no fechamento do mês considera obrigações que já existiam
      // naquele momento, independentemente de o vencimento ser futuro.
      const created = validDate(e.created_at);
      if (!created || created > end) return s;
      const paid = paidStatus(e.status);
      const paidAt = validDate(e.paid_at);
      if (paid && paidAt && paidAt <= end) return s;
      return s + n(e.amount);
    }, 0);
  }

  const initialOutflow = totalCashOut;

  const currentRow = historyRows[historyRows.length - 1];
  const previousRow = historyRows.length > 1 ? historyRows[historyRows.length - 2] : null;
  const toMonth = (row: HistoryRow) => ({
    label: row.label,
    gross: row.gross,
    received: row.received,
    expensesPaid: row.outflow,
    result: row.cashResult,
  });
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
      </div>

      <MonthlySummary current={currentMonth} previous={previousMonth} />

      <div className="grid four-col" style={{ marginTop: 18 }}>
        <div className="card">
          <span className="muted">Faturamento acumulado</span>
          <h2>{money(totalGross)}</h2>
          <small className="muted">Vendas válidas</small>
        </div>
        <div className="card">
          <span className="muted">Caixa disponível acumulado</span>
          <h2 className={cashBalance < 0 ? "error" : ""}>{money(cashBalance)}</h2>
          <small className="muted">Recebido − saídas pagas</small>
        </div>
        <div className="card">
          <span className="muted">A receber</span>
          <h2>{money(Math.max(totalGross - totalReceived, 0))}</h2>
          <small className="muted">Vendas ainda não recebidas</small>
        </div>
        <div className="card">
          <span className="muted">Contas a pagar</span>
          <h2 className={payableTotal > 0 ? "error" : ""}>
            {payableTotal > 0 ? money(-payableTotal) : money(0)}
          </h2>
          <small className="muted">Obrigações em aberto</small>
        </div>
      </div>

      <div className="grid four-col" style={{ marginTop: 12 }}>
        <div className="card">
          <span className="muted">Saídas acumuladas</span>
          <h2>{money(totalCashOut)}</h2>
          <small className="muted">Compras + despesas pagas + equipamentos</small>
        </div>
        <div className="card">
          <span className="muted">Resultado operacional</span>
          <h2 className={operatingResult < 0 ? "error" : ""}>{money(operatingResult)}</h2>
          <small className="muted">Antes de considerar o caixa</small>
        </div>
        <div className="card">
          <span className="muted">Recuperação do caixa</span>
          <h2>{recovery.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</h2>
          <small className="muted">Recebimentos ÷ saídas acumuladas</small>
        </div>
        <div className="card">
          <span className="muted">Taxas de marketplace</span>
          <h2>{money(totalFees)}</h2>
          <small className="muted">
            {validOrders.filter((o) => n(o.marketplace_fee) > 0).length} pedidos com taxa
          </small>
        </div>
      </div>

      <FinanceTabs
        summary={{
          qty: totalQty,
          gross: totalGross,
          received: totalReceived,
          receivable: Math.max(totalGross - totalReceived, 0),
          profit: operatingResult,
        }}
        rows={rows}
        fees={{
          total: totalFees,
          count: validOrders.filter((o) => n(o.marketplace_fee) > 0).length,
        }}
        labor={{ total: totalLabor, items: totalLaborItems }}
        spent={totalCashOut}
        initialLaborHourRate={n(settings?.labor_hour_rate ?? 30)}
      />
      <FinancialHistory
        rows={historyRows}
        totalPayable={payableTotal}
        totalReceivable={Math.max(totalGross - totalReceived, 0)}
        totalOutflow={initialOutflow}
        totalGross={totalGross}
        totalReceived={totalReceived}
      />

      <div className="grid" style={{ gridTemplateColumns: "1fr 2fr", marginTop: 18 }}>
        <CreateExpenseForm />
        <ExpenseList expenses={(expenses ?? []) as Expense[]} />
      </div>

      <div style={{ marginTop: 18 }}>
        <RecurringExpensesManager items={recurringExpenses ?? []} />
      </div>
    </div>
  );
}
