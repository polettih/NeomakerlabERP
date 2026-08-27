"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";

export function CreateExpenseForm() {
  const r = useRouter();
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          category: category || null,
          amount: Number(amount),
          due_date: dueDate || null,
          status: paid ? "paid" : "pending",
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Erro");
      setDescription("");
      setCategory("");
      setAmount("");
      setDueDate("");
      setPaid(false);
      r.refresh();
    } catch (err: any) {
      setError(err.message || "Erro");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card grid">
      <h2>Nova despesa</h2>
      {error && <div className="error">{error}</div>}
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
        <label>Vencimento</label>
        <input
          className="input"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>
      <div className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <input
          id="paid-now"
          type="checkbox"
          checked={paid}
          onChange={(e) => setPaid(e.target.checked)}
        />
        <label htmlFor="paid-now" style={{ marginBottom: 0 }}>
          Já foi paga
        </label>
      </div>
      <button className="btn btn-primary" disabled={busy}>
        {busy ? "Salvando..." : "Salvar despesa"}
      </button>
    </form>
  );
}
