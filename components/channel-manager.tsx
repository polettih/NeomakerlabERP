"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
type Channel = {
  id: string;
  name: string;
  active: boolean;
  fee_percent: number;
  fixed_fee: number;
};

// Valores de referência coletados em ago/2026, com base nas tabelas públicas de cada
// marketplace. As comissões variam por categoria, reputação e tipo de anúncio — use
// como ponto de partida e confira o valor exato na Central do Vendedor de cada canal
// antes de confiar 100% no número. Preenche os campos do formulário; nada é salvo até
// clicar em "Adicionar canal".
const PRESETS = [
  {
    label: "Mercado Livre — Clássico",
    fee: 12,
    fixed: 6,
    note: "12% é a média da faixa 10–14% (varia por categoria) + R$6 fixos em itens abaixo de R$79",
  },
  {
    label: "Mercado Livre — Premium",
    fee: 17,
    fixed: 6,
    note: "17% é a média da faixa 15–19% (varia por categoria) + R$6 fixos em itens abaixo de R$79",
  },
  {
    label: "Shopee — até R$79,99",
    fee: 20,
    fixed: 4,
    note: "Faixa de preço mais baixa: 20% + R$4 fixos por item",
  },
  {
    label: "Shopee — R$80 a R$99,99",
    fee: 14,
    fixed: 16,
    note: "14% + R$16 fixos por item",
  },
  {
    label: "Shopee — R$100 a R$199,99",
    fee: 14,
    fixed: 20,
    note: "14% + R$20 fixos por item",
  },
  {
    label: "Shopee — a partir de R$200",
    fee: 14,
    fixed: 26,
    note: "14% + R$26 fixos por item (sem teto de comissão)",
  },
  {
    label: "Elo7 — Padrão",
    fee: 18,
    fixed: 3.99,
    note: "18% + R$3,99 fixos por item vendido",
  },
  {
    label: "Elo7 — Destaque",
    fee: 20,
    fixed: 3.99,
    note: "20% + R$3,99 fixos por item vendido",
  },
  {
    label: "Venda direta (Instagram/WhatsApp/PIX)",
    fee: 0,
    fixed: 0,
    note: "Sem intermediário — nenhuma taxa de marketplace",
  },
];

export function ChannelManager({ channels }: { channels: Channel[] }) {
  const [name, setName] = useState("");
  const [fee, setFee] = useState("");
  const [fixed, setFixed] = useState("");
  const [presetNote, setPresetNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const r = useRouter();
  function applyPreset(p: (typeof PRESETS)[number]) {
    setName(p.label);
    setFee(String(p.fee));
    setFixed(String(p.fixed));
    setPresetNote(p.note);
  }
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
      setPresetNote("");
      r.refresh();
    }
  }
  async function update(id: string, body: Partial<Pick<Channel, "name" | "active" | "fee_percent" | "fixed_fee">>) {
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
      <div className="field" style={{ marginBottom: 4 }}>
        <label>Preencher com taxas de um marketplace conhecido</label>
        <div className="filters-row">
          {PRESETS.map((p) => (
            <button
              type="button"
              key={p.label}
              className="btn btn-secondary btn-sm"
              onClick={() => applyPreset(p)}
            >
              {p.label}
            </button>
          ))}
        </div>
        {presetNote && (
          <p className="muted" style={{ marginTop: 6 }}>
            ℹ️ {presetNote}. Valores de referência (ago/2026) — confira o percentual exato da
            sua categoria na Central do Vendedor antes de confirmar.
          </p>
        )}
      </div>
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
