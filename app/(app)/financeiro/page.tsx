import { requireUser } from "@/lib/auth";
import { CreateExpenseForm } from "@/components/create-expense-form";

type CategoryRow = {
  category: string;
  qty: number;
  sales: number;
  cost: number;
  received: number;
  fees: number;
  shipping: number;
};

type Summary = Omit<CategoryRow, "category"> & {
  receivable: number;
  profit: number;
};

type CategorySales = Record<string, number>;

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const numberValue = (value: unknown) => Number(value ?? 0);

export default async function FinanceiroPage() {
  const { supabase } = await requireUser();

  const [{ data: orders }, { data: items }, { data: payments }, { data: expenses }] =
    await Promise.all([
      supabase
        .from("orders")
        .select("id,status,total,shipping_cost,marketplace_fee"),
      supabase
        .from("order_items")
        .select(
          "order_id,product_name,quantity,unit_price,unit_cost,total,products(category)"
        ),
      supabase.from("payments").select("order_id,amount"),
      supabase
        .from("expenses")
        .select("id,description,category,amount,status,due_date")
        .order("created_at", { ascending: false }),
    ]);

  const validOrders = (orders ?? []).filter((order) => order.status !== "cancelled");
  const validOrderIds = new Set(validOrders.map((order) => order.id));

  const paidByOrder = new Map<string, number>();
  for (const payment of payments ?? []) {
    if (!payment.order_id || !validOrderIds.has(payment.order_id)) continue;
    const previous = paidByOrder.get(payment.order_id) ?? 0;
    paidByOrder.set(payment.order_id, previous + numberValue(payment.amount));
  }

  const rows: Record<string, CategoryRow> = {};

  for (const item of items ?? []) {
    if (!validOrderIds.has(item.order_id)) continue;

    const product = Array.isArray(item.products) ? item.products[0] : item.products;
    const category = product?.category || "Outros";
    const quantity = numberValue(item.quantity);
    const sales = numberValue(item.total) || numberValue(item.unit_price) * quantity;
    const cost = numberValue(item.unit_cost) * quantity;

    if (!rows[category]) {
      rows[category] = {
        category,
        qty: 0,
        sales: 0,
        cost: 0,
        received: 0,
        fees: 0,
        shipping: 0,
      };
    }

    rows[category].qty += quantity;
    rows[category].sales += sales;
    rows[category].cost += cost;
  }

  for (const order of validOrders) {
    const categorySales: CategorySales = {};

    for (const item of items ?? []) {
      if (item.order_id !== order.id) continue;

      const product = Array.isArray(item.products) ? item.products[0] : item.products;
      const category = product?.category || "Outros";
      const quantity = numberValue(item.quantity);
      const sales = numberValue(item.total) || numberValue(item.unit_price) * quantity;

      categorySales[category] = (categorySales[category] ?? 0) + sales;
    }

    const totalBase = Object.values(categorySales).reduce(
      (total, value) => total + value,
      0,
    ) || numberValue(order.total);

    if (totalBase <= 0) continue;

    for (const [category, categoryValue] of Object.entries(categorySales)) {
      const row = rows[category];
      if (!row) continue;

      const share = categoryValue / totalBase;
      row.fees += numberValue(order.marketplace_fee) * share;
      row.shipping += numberValue(order.shipping_cost) * share;
      row.received += (paidByOrder.get(order.id) ?? 0) * share;
    }
  }

  const summary: Summary = Object.values(rows).reduce<Summary>(
    (total, row) => {
      total.qty += row.qty;
      total.sales += row.sales;
      total.cost += row.cost;
      total.received += row.received;
      total.fees += row.fees;
      total.shipping += row.shipping;
      return total;
    },
    {
      qty: 0,
      sales: 0,
      cost: 0,
      received: 0,
      fees: 0,
      shipping: 0,
      receivable: 0,
      profit: 0,
    },
  );

  summary.receivable = Math.max(summary.sales - summary.received, 0);
  summary.profit = summary.sales - summary.cost - summary.fees - summary.shipping;

  const spent = (expenses ?? [])
    .filter((expense) => expense.status !== "cancelled")
    .reduce((total, expense) => total + numberValue(expense.amount), 0);

  const categoryRows = Object.values(rows).sort((a, b) => b.sales - a.sales);

  return (
    <div className="content">
      <div className="section-title">
        <div>
          <h1>Financeiro</h1>
          <p className="muted">
            Visão geral das vendas, recebimentos, custos e valores a receber.
          </p>
        </div>
      </div>

      <div className="grid cards">
        <div className="card">
          <div className="label">Itens vendidos</div>
          <div className="value">{summary.qty}</div>
        </div>
        <div className="card">
          <div className="label">Valor vendido</div>
          <div className="value">{money(summary.sales)}</div>
        </div>
        <div className="card">
          <div className="label">Valor recebido</div>
          <div className="value kpi-green">{money(summary.received)}</div>
        </div>
        <div className="card">
          <div className="label">A receber das vendas</div>
          <div className="value kpi-yellow">{money(summary.receivable)}</div>
        </div>
        <div className="card">
          <div className="label">Lucro líquido das vendas</div>
          <div className="value">{money(summary.profit)}</div>
        </div>
        <div className="card">
          <div className="label">Despesas gerais</div>
          <div className="value">{money(spent)}</div>
        </div>
        <div className="card">
          <div className="label">Resultado após despesas</div>
          <div className="value">{money(summary.profit - spent)}</div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 2fr", marginTop: 18 }}>
        <CreateExpenseForm />

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Itens vendidos</th>
                <th>Valor vendido</th>
                <th>Valor recebido</th>
                <th>Lucro líquido</th>
                <th>A receber</th>
              </tr>
            </thead>
            <tbody>
              {categoryRows.map((row) => (
                <tr key={row.category}>
                  <td><strong>{row.category}</strong></td>
                  <td>{row.qty}</td>
                  <td>{money(row.sales)}</td>
                  <td>{money(row.received)}</td>
                  <td>{money(row.sales - row.cost - row.fees - row.shipping)}</td>
                  <td>{money(Math.max(row.sales - row.received, 0))}</td>
                </tr>
              ))}
              {categoryRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    Ainda não existem vendas para consolidar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h2>Gastos e compras</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Valor</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(expenses ?? []).map((expense) => (
                <tr key={expense.id}>
                  <td>{expense.description}</td>
                  <td>{expense.category || "-"}</td>
                  <td>{money(numberValue(expense.amount))}</td>
                  <td><span className="badge">{expense.status}</span></td>
                </tr>
              ))}
              {!expenses?.length && (
                <tr>
                  <td colSpan={4} className="muted">Nenhuma despesa.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
