import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { CreateExpenseForm } from "@/components/create-expense-form";
import { InventoryManager } from "@/components/inventory-manager";
import { ExpenseList } from "@/components/expense-list";
import { PageTabs } from "@/components/page-tabs";
import { money, n, isPaidStatus, isCancelledStatus } from "@/lib/format";
import type { Expense } from "@/lib/types";

export default async function GastosPage() {
  const { supabase } = await requireUser();
  const [{ data: materials }, { data: expenses }, { data: purchases }] = await Promise.all([
    supabase.from("materials").select("*").eq("active", true).order("material_type").order("name"),
    supabase
      .from("expenses")
      .select(
        "id,description,category,amount,status,due_date,paid_at,created_at,source_type,source_id"
      )
      .order("due_date", { ascending: false, nullsFirst: false }),
    supabase
      .from("material_purchases")
      .select("id,total_cost,created_at")
      .order("created_at", { ascending: false }),
  ]);
  const validExpenses = ((expenses ?? []) as Expense[]).filter((e) => !isCancelledStatus(e.status));
  const materialPurchasesTotal = (purchases ?? []).reduce((sum, p) => sum + n(p.total_cost), 0);
  // "Saídas registradas" é dinheiro que já saiu do caixa: só despesas PAGAS +
  // compras de material (que representam gasto já efetivado). Despesas ainda
  // em aberto entram no card "Despesas em aberto" — somar as duas coisas aqui
  // contaria a mesma despesa em aberto duas vezes.
  const paidExpenseTotal = validExpenses
    .filter((e) => isPaidStatus(e.status))
    .reduce((sum, e) => sum + n(e.amount), 0);
  const payableTotal = validExpenses
    .filter((e) => !isPaidStatus(e.status))
    .reduce((sum, e) => sum + n(e.amount), 0);
  const stockValue = (materials ?? []).reduce(
    (sum: number, m: { quantity_on_hand?: number | string | null; average_cost?: number | string | null }) =>
      sum + n(m.quantity_on_hand) * n(m.average_cost),
    0
  );
  return (
    <div className="content">
      <div className="section-title">
        <div>
          <h1>🛒 Gastos e compras</h1>
          <p className="muted">
            Gestão unificada de estoque, compras, insumos e demais gastos da operação.
          </p>
        </div>
        <Link className="btn btn-secondary" href="/financeiro">
          Ver relatório financeiro completo →
        </Link>
      </div>
      <div className="grid four-col" style={{ marginBottom: 18 }}>
        <div className="card">
          <span className="muted">Materiais cadastrados</span>
          <h2>{materials?.length || 0}</h2>
        </div>
        <div className="card">
          <span className="muted">Valor em estoque</span>
          <h2>{money(stockValue)}</h2>
        </div>
        <div className="card">
          <span className="muted">Saídas registradas</span>
          <h2>{money(paidExpenseTotal + materialPurchasesTotal)}</h2>
          <small className="muted">Despesas pagas + compras de material</small>
        </div>
        <div className="card">
          <span className="muted">Despesas em aberto</span>
          <h2 className={payableTotal > 0 ? "error" : ""}>{money(payableTotal)}</h2>
        </div>
      </div>
      <PageTabs
        defaultTab="estoque"
        tabs={[
          {
            id: "estoque",
            label: "📦 Estoque de materiais",
            content: <InventoryManager materials={materials ?? []} />,
          },
          {
            id: "despesas",
            label: "🧾 Despesas avulsas",
            content: (
              <div className="grid two-col">
                <CreateExpenseForm />
                <ExpenseList expenses={(expenses ?? []) as Expense[]} />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
