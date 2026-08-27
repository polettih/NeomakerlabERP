"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";
import { money, n, monthKey as monthKeyOf, monthLabel, formatDate, isPaidStatus, isCancelledStatus } from "@/lib/format";
import { errorMessage } from "@/lib/errors";
import type { Expense } from "@/lib/types";

function EditableRow({ expense, onDone }: { expense: Expense; onDone: () => void }) {
  const [description, setDescription] = useState(expense.description);
  const [category, setCategory] = useState(expense.category || "");
  const [amount, setAmount] = useState(String(n(expense.amount)));
  const [dueDate, setDueDate] = useState(expense.due_date ? expense.due_date.slice(0, 10) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/expenses/${expense.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          category: category || null,
          amount: Number(amount),
          due_date: dueDate || null,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Erro ao salvar.");
      onDone();
    } catch (e) {
      setError(errorMessage(e, "Erro ao salvar."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr>
      <td>
        <input
          className="input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </td>
      <td>
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Sem categoria</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </td>
      <td>
        <input
          className="input"
          type="number"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ maxWidth: 120 }}
        />
      </td>
      <td>
        <input
          className="input"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </td>
      <td colSpan={2}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn btn-primary" disabled={busy} onClick={save}>
            {busy ? "Salvando..." : "Salvar"}
          </button>
          <button className="btn btn-secondary" disabled={busy} onClick={onDone}>
            Cancelar
          </button>
        </div>
        {error && (
          <div className="error" style={{ marginTop: 6 }}>
            {error}
          </div>
        )}
      </td>
    </tr>
  );
}

export function ExpenseList({ expenses }: { expenses: Expense[] }) {
  const r = useRouter();
  const [monthFilter, setMonthFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "paid" | "cancelled">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const months = useMemo(() => {
    const keys = new Set<string>();
    for (const e of expenses) {
      const k = monthKeyOf(e.due_date) || monthKeyOf(e.paid_at);
      if (k) keys.add(k);
    }
    return [...keys].sort().reverse();
  }, [expenses]);

  const visible = useMemo(() => {
    return expenses.filter((e) => {
      if (monthFilter !== "all" && (monthKeyOf(e.due_date) || monthKeyOf(e.paid_at)) !== monthFilter)
        return false;
      if (statusFilter === "paid" && !isPaidStatus(e.status)) return false;
      if (statusFilter === "cancelled" && !isCancelledStatus(e.status)) return false;
      if (statusFilter === "pending" && (isPaidStatus(e.status) || isCancelledStatus(e.status)))
        return false;
      return true;
    });
  }, [expenses, monthFilter, statusFilter]);

  async function toggleStatus(e: Expense) {
    setBusyId(e.id);
    setError("");
    try {
      const nextStatus = isPaidStatus(e.status) ? "pending" : "paid";
      const res = await fetch(`/api/expenses/${e.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Erro ao atualizar status.");
      r.refresh();
    } catch (err) {
      setError(errorMessage(err, "Erro ao atualizar status."));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(e: Expense) {
    if (!confirm(`Excluir a despesa "${e.description}"?`)) return;
    setBusyId(e.id);
    setError("");
    try {
      const res = await fetch(`/api/expenses/${e.id}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Erro ao excluir.");
      r.refresh();
    } catch (err) {
      setError(errorMessage(err, "Erro ao excluir."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="card">
      <div className="section-title">
        <div>
          <h2>Gastos e compras</h2>
          <p className="muted">
            Lançamentos pagos e obrigações em aberto que alimentam o fluxo de caixa.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select
            className="input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            style={{ maxWidth: 150 }}
            aria-label="Filtrar por status"
          >
            <option value="all">Todos os status</option>
            <option value="pending">A pagar</option>
            <option value="paid">Pagas</option>
            <option value="cancelled">Canceladas</option>
          </select>
          <select
            className="input"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            style={{ maxWidth: 180 }}
            aria-label="Filtrar por mês"
          >
            <option value="all">Todos os meses</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && (
        <div className="error" role="alert" style={{ marginBottom: 10 }}>
          {error}
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Categoria</th>
              <th>Valor</th>
              <th>Vencimento</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((e) =>
              editingId === e.id ? (
                <EditableRow
                  key={e.id}
                  expense={e}
                  onDone={() => {
                    setEditingId(null);
                    r.refresh();
                  }}
                />
              ) : (
                <tr key={e.id}>
                  <td>{e.description}</td>
                  <td>{e.category || "-"}</td>
                  <td>{money(n(e.amount))}</td>
                  <td>{formatDate(e.due_date)}</td>
                  <td>
                    <span
                      className={`badge ${isPaidStatus(e.status) ? "kpi-green" : isCancelledStatus(e.status) ? "" : "kpi-yellow"}`}
                    >
                      {isPaidStatus(e.status) ? "Paga" : isCancelledStatus(e.status) ? "Cancelada" : "A pagar"}
                    </span>
                    {e.source_type === "recurring" && (
                      <small className="muted" style={{ marginLeft: 6 }}>
                        recorrente
                      </small>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {!isCancelledStatus(e.status) && (
                        <button
                          className="btn btn-secondary"
                          disabled={busyId === e.id}
                          onClick={() => toggleStatus(e)}
                        >
                          {isPaidStatus(e.status) ? "Marcar a pagar" : "Marcar paga"}
                        </button>
                      )}
                      <button
                        className="btn btn-secondary"
                        disabled={busyId === e.id}
                        onClick={() => setEditingId(e.id)}
                      >
                        Editar
                      </button>
                      <button
                        className="btn btn-secondary"
                        disabled={busyId === e.id}
                        onClick={() => remove(e)}
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              )
            )}
            {!visible.length && (
              <tr>
                <td colSpan={6} className="muted">
                  Nenhuma despesa neste filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
