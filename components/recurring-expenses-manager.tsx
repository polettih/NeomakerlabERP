"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";

type Recurring = {
  id: string;
  description: string;
  category: string | null;
  amount: unknown;
  day_of_month: number;
  active: boolean;
};

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const n = (v: unknown) => {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
};

export function RecurringExpensesManager({ items }: { items: Recurring[] }) {
  const r = useRouter();
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/recurring-expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          category: category || null,
          amount: Number(amount),
          day_of_month: Number(dayOfMonth),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Erro");
      setDescription("");
      setCategory("");
      setAmount("");
      setDayOfMonth("1");
      r.refresh();
    } catch (err: any) {
      setError(err.message || "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(item: Recurring) {
    setBusyId(item.id);
    try {
      await fetch(`/api/recurring-expenses/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !item.active }),
      });
      r.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(item: Recurring) {
    if (
      !confirm(
        `Excluir a recorrência "${item.description}"? Despesas já geradas não serão apagadas.`
      )
    )
      return;
    setBusyId(item.id);
    try {
      await fetch(`/api/recurring-expenses/${item.id}`, { method: "DELETE" });
      r.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="card">
      <div className="section-title">
        <div>
          <h2>Despesas recorrentes</h2>
          <p className="muted">
            Aluguel, internet, assinaturas e outros gastos fixos. São lançados automaticamente todo
            mês, no dia escolhido, como &quot;a pagar&quot;.
          </p>
        </div>
      </div>
      <form
        onSubmit={submit}
        className="grid"
        style={{
          gridTemplateColumns: "2fr 1.5fr 1fr 1fr auto",
          gap: 10,
          alignItems: "end",
          marginBottom: 16,
        }}
      >
        <div className="field">
          <label>Descrição</label>
          <input
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label>Categoria</label>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Sem categoria</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Valor</label>
          <input
            className="input"
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label>Dia do mês</label>
          <input
            className="input"
            type="number"
            min="1"
            max="28"
            value={dayOfMonth}
            onChange={(e) => setDayOfMonth(e.target.value)}
            required
          />
        </div>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Salvando..." : "Adicionar"}
        </button>
      </form>
      {error && (
        <div className="error" style={{ marginBottom: 10 }}>
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
              <th>Dia</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.description}</td>
                <td>{item.category || "-"}</td>
                <td>{money(n(item.amount))}</td>
                <td>{item.day_of_month}</td>
                <td>
                  <span className={`badge ${item.active ? "kpi-green" : ""}`}>
                    {item.active ? "Ativa" : "Inativa"}
                  </span>
                </td>
                <td>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      className="btn btn-secondary"
                      disabled={busyId === item.id}
                      onClick={() => toggleActive(item)}
                    >
                      {item.active ? "Desativar" : "Ativar"}
                    </button>
                    <button
                      className="btn btn-secondary"
                      disabled={busyId === item.id}
                      onClick={() => remove(item)}
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={6} className="muted">
                  Nenhuma despesa recorrente cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
