"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { errorMessage } from "@/lib/errors";
import type { Machine } from "@/lib/types";
const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function MachineManager({ machines }: { machines: Machine[] }) {
  const r = useRouter();
  const blank = {
    name: "",
    category: "Impressora FDM",
    power_kw: "0",
    purchase_value: "0",
    useful_hours: "0",
    purchase_date: "",
    notes: "",
  };
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<Machine | null>(null);
  const [error, setError] = useState("");
  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/machines", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { ...form, id: editing.id } : form),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Erro");
      setForm(blank);
      setEditing(null);
      r.refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function toggleActive(m: Machine) {
    setError("");
    const res = await fetch("/api/machines", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: m.id, active: !m.active }),
    });
    const j = await res.json();
    if (!res.ok) setError(j.error || "Erro");
    else r.refresh();
  }
  async function remove(m: Machine) {
    if (
      !confirm(
        `Excluir "${m.name}" definitivamente? A despesa de compra deste equipamento também será removida do Financeiro. Esta ação não pode ser desfeita — se preferir manter o histórico, use "Desativar" em vez de excluir.`
      )
    )
      return;
    setError("");
    const res = await fetch("/api/machines", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: m.id }),
    });
    const j = await res.json();
    if (!res.ok) setError(j.error || "Erro");
    else r.refresh();
  }
  function edit(m: Machine) {
    setEditing(m);
    setForm({
      name: m.name,
      category: m.category,
      power_kw: String(m.power_kw || 0),
      purchase_value: String(m.purchase_value || 0),
      useful_hours: String(m.useful_hours || 0),
      purchase_date: m.purchase_date || "",
      notes: m.notes || "",
    });
  }
  return (
    <div className="grid two-col">
      {error && (
        <div className="error" role="alert" style={{ gridColumn: "1/-1" }}>
          {error}
        </div>
      )}
      <form className="card grid" onSubmit={save}>
        <div className="section-title">
          <h2>{editing ? "✏️ Editar equipamento" : "＋ Novo equipamento"}</h2>
          {editing && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setEditing(null);
                setForm(blank);
              }}
            >
              Cancelar
            </button>
          )}
        </div>
        <div className="field">
          <label>Nome</label>
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>
        <div className="form-grid">
          <div className="field">
            <label>Tipo</label>
            <select
              className="select"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              <option>Impressora FDM</option>
              <option>Impressora Resina</option>
              <option>Maquinário</option>
            </select>
          </div>
          <div className="field">
            <label>Potência (W)</label>
            <input
              className="input"
              type="number"
              step="1"
              min="0"
              placeholder="Ex.: 350 (veja na etiqueta ou na fonte da impressora)"
              value={form.power_kw === "0" ? "" : String(Math.round(Number(form.power_kw) * 1000))}
              onChange={(e) =>
                setForm({ ...form, power_kw: String((Number(e.target.value) || 0) / 1000) })
              }
            />
            <small className="muted">
              Use o valor em Watts (W) da etiqueta ou da fonte de alimentação — não o de kW.
            </small>
          </div>
          <div className="field">
            <label>Valor de aquisição</label>
            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              value={form.purchase_value}
              onChange={(e) => setForm({ ...form, purchase_value: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Vida útil (horas)</label>
            <input
              className="input"
              type="number"
              step="1"
              min="0"
              value={form.useful_hours}
              onChange={(e) => setForm({ ...form, useful_hours: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Data da compra</label>
            <input
              className="input"
              type="date"
              value={form.purchase_date}
              onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
            />
          </div>
        </div>
        <p className="muted">
          Depreciação:{" "}
          <strong>
            {money(
              Number(form.useful_hours) > 0
                ? Number(form.purchase_value || 0) / Number(form.useful_hours)
                : 0
            )}
            /h
          </strong>
          . A compra é lançada automaticamente em Gastos e Compras.
        </p>
        <div className="field">
          <label>Observações</label>
          <textarea
            className="input"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
        <button className="btn btn-primary">
          {editing ? "Salvar alterações" : "Cadastrar equipamento"}
        </button>
      </form>
      <div className="card table-wrap">
        <h2>Equipamentos cadastrados</h2>
        <table>
          <thead>
            <tr>
              <th>Equipamento</th>
              <th>Tipo</th>
              <th>Potência</th>
              <th>Aquisição</th>
              <th>Depreciação/h</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {machines.map((m) => (
              <tr key={m.id}>
                <td>
                  <strong>{m.name}</strong>
                </td>
                <td>{m.category}</td>
                <td>{Math.round(Number(m.power_kw) * 1000)} W</td>
                <td>{money(Number(m.purchase_value || 0))}</td>
                <td>{money(Number(m.depreciation_per_hour || 0))}</td>
                <td>
                  <span className={`badge ${m.active ? "green" : "yellow"}`}>
                    {m.active ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td>
                  <div className="actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => edit(m)}>
                      Editar
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => toggleActive(m)}>
                      {m.active ? "Desativar" : "Ativar"}
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => remove(m)}>
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!machines.length && (
              <tr>
                <td colSpan={7} className="muted">
                  Nenhum equipamento cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
