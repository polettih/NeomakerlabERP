"use client";
import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/format";
import type { FeeBand } from "@/lib/fee-bands";

type Channel = {
  id: string;
  name: string;
  active: boolean;
  fee_percent: number;
  fixed_fee: number;
  fee_bands: FeeBand[];
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
    bands: null as FeeBand[] | null,
  },
  {
    label: "Mercado Livre — Premium",
    fee: 17,
    fixed: 6,
    note: "17% é a média da faixa 15–19% (varia por categoria) + R$6 fixos em itens abaixo de R$79",
    bands: null as FeeBand[] | null,
  },
  {
    label: "Shopee (faixas automáticas por preço)",
    fee: 14,
    fixed: 20,
    note: "A taxa certa é escolhida sozinha pelo valor de cada pedido — não precisa mais criar um canal por faixa.",
    bands: [
      { min: 0, max: 79.99, fee_percent: 0.2, fixed_fee: 4 },
      { min: 80, max: 99.99, fee_percent: 0.14, fixed_fee: 16 },
      { min: 100, max: 199.99, fee_percent: 0.14, fixed_fee: 20 },
      { min: 200, max: null, fee_percent: 0.14, fixed_fee: 26 },
    ] as FeeBand[] | null,
  },
  {
    label: "Elo7 — Padrão",
    fee: 18,
    fixed: 3.99,
    note: "18% + R$3,99 fixos por item vendido",
    bands: null as FeeBand[] | null,
  },
  {
    label: "Elo7 — Destaque",
    fee: 20,
    fixed: 3.99,
    note: "20% + R$3,99 fixos por item vendido",
    bands: null as FeeBand[] | null,
  },
  {
    label: "Venda direta (Instagram/WhatsApp/PIX)",
    fee: 0,
    fixed: 0,
    note: "Sem intermediário — nenhuma taxa de marketplace",
    bands: null as FeeBand[] | null,
  },
];

const emptyBand = (): FeeBand => ({ min: 0, max: null, fee_percent: 0, fixed_fee: 0 });

function FeeBandsEditor({
  bands,
  onChange,
}: {
  bands: FeeBand[];
  onChange: (bands: FeeBand[]) => void;
}) {
  function update(i: number, patch: Partial<FeeBand>) {
    onChange(bands.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  }
  function remove(i: number) {
    onChange(bands.filter((_, idx) => idx !== i));
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {bands.map((b, i) => (
        <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span className="muted" style={{ minWidth: 14 }}>
            {i + 1}.
          </span>
          <input
            className="input"
            type="number"
            min="0"
            step="0.01"
            placeholder="De (R$)"
            style={{ maxWidth: 100 }}
            value={b.min}
            onChange={(e) => update(i, { min: Number(e.target.value) || 0 })}
          />
          <span>a</span>
          <input
            className="input"
            type="number"
            min="0"
            step="0.01"
            placeholder="Sem teto"
            style={{ maxWidth: 100 }}
            value={b.max ?? ""}
            onChange={(e) => update(i, { max: e.target.value === "" ? null : Number(e.target.value) })}
          />
          <input
            className="input"
            type="number"
            min="0"
            max="100"
            step="0.01"
            placeholder="Taxa %"
            style={{ maxWidth: 90 }}
            value={(b.fee_percent * 100).toFixed(2)}
            onChange={(e) => update(i, { fee_percent: Math.max(0, Math.min(100, Number(e.target.value) || 0)) / 100 })}
          />
          <span>%+</span>
          <input
            className="input"
            type="number"
            min="0"
            step="0.01"
            placeholder="Fixa R$"
            style={{ maxWidth: 90 }}
            value={b.fixed_fee}
            onChange={(e) => update(i, { fixed_fee: Math.max(0, Number(e.target.value) || 0) })}
          />
          <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(i)}>
            ✕
          </button>
          <small className="muted">
            {money(b.min)}
            {b.max !== null ? ` – ${money(b.max)}` : "+"}: {(b.fee_percent * 100).toFixed(2)}% +{" "}
            {money(b.fixed_fee)}
          </small>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        style={{ alignSelf: "flex-start" }}
        onClick={() => onChange([...bands, emptyBand()])}
      >
        + Adicionar faixa
      </button>
    </div>
  );
}

export function ChannelManager({ channels }: { channels: Channel[] }) {
  const [name, setName] = useState("");
  const [fee, setFee] = useState("");
  const [fixed, setFixed] = useState("");
  const [bands, setBands] = useState<FeeBand[] | null>(null);
  const [presetNote, setPresetNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editBands, setEditBands] = useState<Record<string, FeeBand[]>>({});
  const r = useRouter();
  function applyPreset(p: (typeof PRESETS)[number]) {
    setName(p.label);
    setFee(String(p.fee));
    setFixed(String(p.fixed));
    setPresetNote(p.note);
    setBands(p.bands ? p.bands.map((b) => ({ ...b })) : null);
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
        fee_bands: bands ?? [],
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
      setBands(null);
      r.refresh();
    }
  }
  async function update(
    id: string,
    body: Partial<Pick<Channel, "name" | "active" | "fee_percent" | "fixed_fee" | "fee_bands">>
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
        Canais com faixas de preço (como a Shopee) calculam a taxa certa sozinhos, pelo valor de
        cada pedido.
      </p>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
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
            ℹ️ {presetNote} Valores de referência (ago/2026) — confira o percentual exato da
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
        {bands ? (
          <div className="field" style={{ gridColumn: "span 3" }}>
            <label>Faixas de preço (taxa escolhida automaticamente por pedido)</label>
            <FeeBandsEditor bands={bands} onChange={setBands} />
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ marginTop: 6, alignSelf: "flex-start" }}
              onClick={() => setBands(null)}
            >
              Usar taxa única em vez de faixas
            </button>
          </div>
        ) : (
          <>
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
            <div className="field">
              <label>&nbsp;</label>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setBands([emptyBand()])}
              >
                Usar faixas de preço em vez de taxa única
              </button>
            </div>
          </>
        )}
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
            {channels.map((c) => {
              const hasBands = (c.fee_bands ?? []).length > 0;
              const editingBands = editBands[c.id] ?? c.fee_bands ?? [];
              return (
                <Fragment key={c.id}>
                  <tr>
                    <td>
                      <input
                        className="input"
                        defaultValue={c.name}
                        onBlur={(e) => {
                          if (e.target.value.trim() !== c.name)
                            update(c.id, { name: e.target.value });
                        }}
                      />
                    </td>
                    <td>
                      {hasBands ? (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                        >
                          {c.fee_bands.length} faixas {expandedId === c.id ? "▲" : "▼"}
                        </button>
                      ) : (
                        <>
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
                              if (v !== Number(c.fee_percent) * 100)
                                update(c.id, { fee_percent: v / 100 });
                            }}
                          />
                          %
                        </>
                      )}
                    </td>
                    <td>
                      {hasBands ? (
                        <span className="muted">varia</span>
                      ) : (
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
                      )}
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
                      <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => remove(c.id)}>
                        Excluir
                      </button>
                    </td>
                  </tr>
                  {hasBands && expandedId === c.id && (
                    <tr key={`${c.id}-bands`}>
                      <td colSpan={5}>
                        <FeeBandsEditor
                          bands={editingBands}
                          onChange={(next) => setEditBands((prev) => ({ ...prev, [c.id]: next }))}
                        />
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          style={{ marginTop: 8 }}
                          disabled={busy}
                          onClick={() => {
                            update(c.id, { fee_bands: editingBands });
                            setExpandedId(null);
                          }}
                        >
                          Salvar faixas
                        </button>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
