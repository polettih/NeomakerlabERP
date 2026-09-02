"use client";
import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";

type Channel = {
  id: string;
  name: string;
  active: boolean;
  fee_percent: number;
  fixed_fee: number;
};
type Tier = {
  id?: string;
  min_value: number;
  max_value: number | null;
  fee_percent: number;
  fixed_fee: number;
};

// Faixas da Shopee (mudou a estrutura de comissão em mar/2026: não é mais um
// percentual único, varia por faixa de preço do item). Ver PRESETS abaixo.
const SHOPEE_TIERS: Tier[] = [
  { min_value: 0, max_value: 80, fee_percent: 0.2, fixed_fee: 4 },
  { min_value: 80, max_value: 100, fee_percent: 0.14, fixed_fee: 16 },
  { min_value: 100, max_value: 200, fee_percent: 0.14, fixed_fee: 20 },
  { min_value: 200, max_value: null, fee_percent: 0.14, fixed_fee: 26 },
];

// Valores de referência coletados em ago/2026, com base nas tabelas públicas de cada
// marketplace. As comissões variam por categoria, reputação e tipo de anúncio — use
// como ponto de partida e confira o valor exato na Central do Vendedor de cada canal
// antes de confiar 100% no número. Preenche os campos do formulário; nada é salvo até
// clicar em "Adicionar canal".
const PRESETS: {
  label: string;
  fee: number;
  fixed: number;
  note: string;
  tiers?: Tier[];
}[] = [
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
    label: "Shopee — por faixa de preço",
    fee: 0.2, // usado só como reserva; na prática a taxa vem sempre das faixas
    fixed: 4,
    tiers: SHOPEE_TIERS,
    note:
      "Cria o canal já com as 4 faixas de preço da Shopee cadastradas (20%+R$4 até R$79,99; " +
      "14%+R$16 de R$80 a R$99,99; 14%+R$20 de R$100 a R$199,99; 14%+R$26 a partir de R$200)",
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

export function ChannelManager({
  channels,
  tiersByChannel,
}: {
  channels: Channel[];
  tiersByChannel: Record<string, Tier[]>;
}) {
  const [name, setName] = useState("");
  const [fee, setFee] = useState("");
  const [fixed, setFixed] = useState("");
  const [presetNote, setPresetNote] = useState("");
  const [pendingTiers, setPendingTiers] = useState<Tier[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [openTiers, setOpenTiers] = useState<string | null>(null);
  const [draftTiers, setDraftTiers] = useState<Record<string, Tier[]>>({});
  const r = useRouter();

  function applyPreset(p: (typeof PRESETS)[number]) {
    setName(p.label);
    setFee(String(p.fee));
    setFixed(String(p.fixed));
    setPresetNote(p.note);
    setPendingTiers(p.tiers ?? null);
  }

  async function saveTiers(channelId: string, tiers: Tier[]) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/sales-channels/${channelId}/tiers`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tiers }),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(j.error || "Erro ao salvar faixas de preço.");
      return false;
    }
    r.refresh();
    return true;
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
    if (!res.ok) {
      setError(j.error || "Erro ao criar canal.");
      return;
    }
    if (pendingTiers) await saveTiers(j.id, pendingTiers);
    setName("");
    setFee("");
    setFixed("");
    setPresetNote("");
    setPendingTiers(null);
    r.refresh();
  }

  async function update(
    id: string,
    body: Partial<Pick<Channel, "name" | "active" | "fee_percent" | "fixed_fee">>
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

  function tiersFor(channelId: string) {
    return draftTiers[channelId] ?? tiersByChannel[channelId] ?? [];
  }
  function setTierField(channelId: string, index: number, patch: Partial<Tier>) {
    const current = tiersFor(channelId);
    const next = current.map((t, i) => (i === index ? { ...t, ...patch } : t));
    setDraftTiers({ ...draftTiers, [channelId]: next });
  }
  function addTierRow(channelId: string) {
    const current = tiersFor(channelId);
    const last = current[current.length - 1];
    const nextMin = last?.max_value ?? 0;
    setDraftTiers({
      ...draftTiers,
      [channelId]: [...current, { min_value: nextMin, max_value: null, fee_percent: 0, fixed_fee: 0 }],
    });
  }
  function removeTierRow(channelId: string, index: number) {
    const current = tiersFor(channelId);
    setDraftTiers({ ...draftTiers, [channelId]: current.filter((_, i) => i !== index) });
  }

  return (
    <div className="card">
      <h2>Canais de venda</h2>
      <p className="muted">
        Configure as taxas que serão adicionadas à venda bruta quando o canal for selecionado. Um
        canal pode ter uma taxa única ou faixas por valor do pedido (ex.: Shopee).
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
          <label>{pendingTiers ? "Taxa percentual (reserva)" : "Taxa percentual"}</label>
          <input
            className="input"
            type="number"
            min="0"
            max="100"
            step="0.01"
            placeholder="Ex.: 20"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            disabled={!!pendingTiers}
          />
        </div>
        <div className="field">
          <label>{pendingTiers ? "Taxa fixa (reserva)" : "Taxa fixa por pedido"}</label>
          <input
            className="input"
            type="number"
            min="0"
            step="0.01"
            placeholder="Ex.: 4,00"
            value={fixed}
            onChange={(e) => setFixed(e.target.value)}
            disabled={!!pendingTiers}
          />
        </div>
        <div className="field" style={{ justifyContent: "flex-end" }}>
          <button className="btn btn-primary" disabled={busy} onClick={create}>
            + Adicionar canal
          </button>
        </div>
      </div>
      {pendingTiers && (
        <p className="muted" style={{ marginTop: -8, marginBottom: 12 }}>
          Este canal será criado com {pendingTiers.length} faixas de preço automáticas — a taxa
          percentual/fixa acima só é usada como reserva se algum pedido cair fora de todas as
          faixas.
        </p>
      )}
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
              const chTiers = tiersByChannel[c.id] ?? [];
              const editing = openTiers === c.id;
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
                      {chTiers.length ? (
                        <span className="muted">por faixa</span>
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
                      {chTiers.length ? (
                        <span className="muted">—</span>
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
                        onClick={() => setOpenTiers(editing ? null : c.id)}
                      >
                        {chTiers.length ? `Faixas (${chTiers.length})` : "+ Faixas"}
                      </button>{" "}
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
                  {editing && (
                    <tr>
                      <td colSpan={5}>
                        <div className="card" style={{ background: "#0f1318" }}>
                          <p className="muted">
                            Faixas por valor de mercadoria do pedido. A primeira faixa sem
                            correspondência cai na taxa percentual/fixa padrão do canal, acima.
                          </p>
                          {tiersFor(c.id).map((t, i) => (
                            <div
                              key={i}
                              className="filters-row"
                              style={{ marginBottom: 8, alignItems: "center" }}
                            >
                              <span className="muted">De</span>
                              <input
                                className="input"
                                style={{ maxWidth: 110 }}
                                type="number"
                                min="0"
                                step="0.01"
                                value={t.min_value}
                                onChange={(e) =>
                                  setTierField(c.id, i, { min_value: Number(e.target.value) })
                                }
                              />
                              <span className="muted">até</span>
                              <input
                                className="input"
                                style={{ maxWidth: 110 }}
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="sem teto"
                                value={t.max_value ?? ""}
                                onChange={(e) =>
                                  setTierField(c.id, i, {
                                    max_value: e.target.value === "" ? null : Number(e.target.value),
                                  })
                                }
                              />
                              <span className="muted">taxa</span>
                              <input
                                className="input"
                                style={{ maxWidth: 90 }}
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={(t.fee_percent * 100).toFixed(2)}
                                onChange={(e) =>
                                  setTierField(c.id, i, {
                                    fee_percent: Number(e.target.value) / 100,
                                  })
                                }
                              />
                              <span className="muted">% +</span>
                              <input
                                className="input"
                                style={{ maxWidth: 100 }}
                                type="number"
                                min="0"
                                step="0.01"
                                value={t.fixed_fee}
                                onChange={(e) =>
                                  setTierField(c.id, i, { fixed_fee: Number(e.target.value) })
                                }
                              />
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => removeTierRow(c.id, i)}
                              >
                                Remover
                              </button>
                            </div>
                          ))}
                          <div className="actions">
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => addTierRow(c.id)}
                            >
                              + Adicionar faixa
                            </button>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled={busy}
                              onClick={async () => {
                                const ok = await saveTiers(c.id, tiersFor(c.id));
                                if (ok) setOpenTiers(null);
                              }}
                            >
                              Salvar faixas
                            </button>
                          </div>
                        </div>
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
