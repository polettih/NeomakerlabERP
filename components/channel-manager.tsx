"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
type Channel = {
  id: string;
  name: string;
  active: boolean;
  fee_percent: number;
  fixed_fee: number;
};
export function ChannelManager({ channels }: { channels: Channel[] }) {
  const [name, setName] = useState("");
  const [fee, setFee] = useState("");
  const [fixed, setFixed] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const r = useRouter();
  async function create() {
    if (!name.trim()) return setError("Informe o nome do canal.");
    setBusy(true);
    setError("");
    const res = await fetch("/api/sales-channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        fee_percent: Number(fee || 0) / 100,
        fixed_fee: Number(fixed || 0),
      }),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) setError(j.error || "Erro ao criar canal.");
    else {
      setName("");
      setFee("");
      setFixed("");
      r.refresh();
    }
  }
  async function update(
    id: string,
    body: Partial<{ name: string; active: boolean; fee_percent: number; fixed_fee: number }>
  ) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/sales-channels/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) setError(j.error || "Erro ao atualizar canal.");
    else r.refresh();
  }
  async function remove(id: string) {
    if (!confirm("Excluir este canal? Pedidos existentes ficarão sem canal.")) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/sales-channels/${id}`, { method: "DELETE" });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) setError(j.error || "Erro ao excluir canal.");
    else r.refresh();
  }
  return (
    <div className="card">
      <h2>Canais de venda</h2>
      <p className="muted">
        Configure as taxas que serão adicionadas à venda bruta quando o canal for selecionado.
      </p>
      {error && <div className="error">{error}</div>}
      <div className="form-grid">
        <div className="field">
          <label>Novo canal</label>
          <input
            className="input"
            placeholder="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Taxa percentual</label>
          <input
            className="input"
            type="number"
            min="0"
            max="100"
            step="0.01"
            placeholder="Ex.: 20"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Taxa fixa por pedido</label>
          <input
            className="input"
            type="number"
            min="0"
            step="0.01"
            placeholder="Ex.: 4,00"
            value={fixed}
            onChange={(e) => setFixed(e.target.value)}
          />
        </div>
        <div className="field" style={{ justifyContent: "flex-end" }}>
          <button className="btn btn-primary" disabled={busy} onClick={create}>
            + Adicionar canal
          </button>
        </div>
      </div>
      <div className="table-wrap" style={{ marginTop: 18 }}>
        <table>
          <thead>
            <tr>
              <th>Canal</th>
              <th>Taxa</th>
              <th>Fixa</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((c) => (
              <tr key={c.id}>
                <td>
                  <input
                    className="input"
                    defaultValue={c.name}
                    onBlur={(e) => {
                      if (e.target.value.trim() !== c.name) update(c.id, { name: e.target.value });
                    }}
                  />
                </td>
                <td>
                  <input
                    className="input"
                    style={{ maxWidth: 120 }}
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    defaultValue={(Number(c.fee_percent) * 100).toFixed(2)}
                    onBlur={(e) => {
                      const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                      if (v !== Number(c.fee_percent) * 100) update(c.id, { fee_percent: v / 100 });
                    }}
                  />
                  %
                </td>
                <td>
                  <input
                    className="input"
                    style={{ maxWidth: 120 }}
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={Number(c.fixed_fee).toFixed(2)}
                    onBlur={(e) => {
                      const v = Math.max(0, Number(e.target.value) || 0);
                      if (v !== Number(c.fixed_fee)) update(c.id, { fixed_fee: v });
                    }}
                  />
                </td>
                <td>
                  <span className={`badge ${c.active ? "green" : "yellow"}`}>
                    {c.active ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={busy}
                    onClick={() => update(c.id, { active: !c.active })}
                  >
                    {c.active ? "Desativar" : "Ativar"}
                  </button>{" "}
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={busy}
                    onClick={() => remove(c.id)}
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
