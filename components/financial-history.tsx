"use client";

type HistoryRow = {
  key: string;
  label: string;
  gross: number;
  received: number;
  purchases: number;
  expenses: number;
  equipment: number;
  outflow: number;
  cashResult: number;
  cumulative: number;
  receivable: number;
  payable: number;
};

const money = (value: number) => {
  const abs = Math.abs(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return value < 0 ? `R$ - ${abs.replace(/^R\$\s?/, "")}` : abs;
};

const compactMoney = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 1000000) return `R$ ${(abs / 1000000).toFixed(1)} mi`;
  if (abs >= 1000) return `R$ ${(abs / 1000).toFixed(1)} mil`;
  return `R$ ${Math.round(abs)}`;
};

export function FinancialHistory({ rows }: { rows: HistoryRow[] }) {
  if (!rows.length) {
    return (
      <div className="card" style={{ marginTop: 18 }}>
        <h2>Histórico financeiro</h2>
        <p className="muted">Ainda não há movimentações suficientes para montar o histórico.</p>
      </div>
    );
  }

  const maxMonthly = Math.max(1, ...rows.flatMap((r) => [r.gross, r.outflow, r.received]));
  const maxCumulative = Math.max(1, ...rows.map((r) => Math.abs(r.cumulative)));
  const latest = rows[rows.length - 1];
  const totalGross = rows.reduce((s, r) => s + r.gross, 0);
  const totalReceived = rows.reduce((s, r) => s + r.received, 0);
  const totalOutflow = rows.reduce((s, r) => s + r.outflow, 0);
  const totalPayable = rows.reduce((s, r) => s + r.payable, 0);

  return (
    <section style={{ marginTop: 18 }}>
      <div className="section-title">
        <div>
          <h2>Histórico financeiro</h2>
          <p className="muted">Faturamento, recebimentos, saídas e evolução do caixa desde a primeira movimentação.</p>
        </div>
      </div>

      <div className="grid four-col" style={{ marginBottom: 18 }}>
        <div className="card"><span className="muted">Faturamento acumulado</span><h2>{money(totalGross)}</h2></div>
        <div className="card"><span className="muted">Recebido acumulado</span><h2>{money(totalReceived)}</h2></div>
        <div className="card"><span className="muted">Saídas acumuladas</span><h2>{money(totalOutflow)}</h2></div>
        <div className="card"><span className="muted">Contas a pagar</span><h2 className={totalPayable > 0 ? "error" : ""}>{totalPayable > 0 ? money(-totalPayable) : money(0)}</h2></div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <div className="card">
          <div className="section-title"><div><h3>Faturamento × saídas</h3><p className="muted">Comparação mensal.</p></div></div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 230, overflowX: "auto", paddingTop: 12 }}>
            {rows.map((r) => (
              <div key={r.key} title={`${r.label}: faturamento ${money(r.gross)} | saídas ${money(r.outflow)}`} style={{ minWidth: 62, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 185 }}>
                  <div style={{ width: 20, height: `${Math.max(2, (r.gross / maxMonthly) * 100)}%`, background: "#4ade80", borderRadius: "5px 5px 0 0" }} />
                  <div style={{ width: 20, height: `${Math.max(2, (r.outflow / maxMonthly) * 100)}%`, background: "#ff4b4b", borderRadius: "5px 5px 0 0" }} />
                </div>
                <span className="muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{r.label}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 12 }}>
            <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#4ade80", borderRadius: 2, marginRight: 5 }} />Faturamento</span>
            <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#ff4b4b", borderRadius: 2, marginRight: 5 }} />Saídas</span>
          </div>
        </div>

        <div className="card">
          <div className="section-title"><div><h3>Evolução do déficit/superávit</h3><p className="muted">Saldo acumulado do fluxo de caixa.</p></div></div>
          <div style={{ height: 230, position: "relative", marginTop: 12 }}>
            <div style={{ position: "absolute", left: 0, right: 0, top: "50%", borderTop: "1px dashed var(--border, #2b313a)" }} />
            <div style={{ height: "100%", display: "flex", alignItems: "center", gap: 7, overflowX: "auto", padding: "0 4px" }}>
              {rows.map((r) => {
                const positive = r.cumulative >= 0;
                const height = Math.max(4, Math.min(100, (Math.abs(r.cumulative) / maxCumulative) * 100));
                return (
                  <div key={r.key} title={`${r.label}: ${positive ? "superávit" : "déficit"} acumulado ${money(r.cumulative)}`} style={{ minWidth: 48, height: "100%", display: "flex", flexDirection: "column", justifyContent: positive ? "flex-start" : "flex-end", alignItems: "center" }}>
                    <div style={{ height: `${height}%`, width: 24, marginTop: positive ? "auto" : 0, marginBottom: positive ? 0 : "auto", background: positive ? "#4ade80" : "#ff4b4b", borderRadius: 5 }} />
                    <span className="muted" style={{ fontSize: 10, whiteSpace: "nowrap", position: "absolute", bottom: 0 }}>{r.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="grid two-col" style={{ marginTop: 16 }}>
            <div><span className="muted">Saldo acumulado atual</span><h3 className={latest.cumulative < 0 ? "error" : ""}>{money(latest.cumulative)}</h3></div>
            <div><span className="muted">A receber atual</span><h3>{money(latest.receivable)}</h3></div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="section-title">
          <div><h3>Planilha mensal</h3><p className="muted">Histórico preservado por competência. O saldo acumulado mostra quanto falta recuperar do caixa.</p></div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Mês</th><th>Faturamento</th><th>Recebido</th><th>Compras</th><th>Despesas</th><th>Equipamentos</th><th>Saídas</th><th>Resultado</th><th>Acumulado</th><th>A pagar</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td>{r.label}</td>
                  <td>{money(r.gross)}</td>
                  <td>{money(r.received)}</td>
                  <td>{money(r.purchases)}</td>
                  <td>{money(r.expenses)}</td>
                  <td>{money(r.equipment)}</td>
                  <td>{money(r.outflow)}</td>
                  <td className={r.cashResult < 0 ? "error" : ""}>{money(r.cashResult)}</td>
                  <td className={r.cumulative < 0 ? "error" : ""}>{money(r.cumulative)}</td>
                  <td className={r.payable > 0 ? "error" : ""}>{r.payable > 0 ? money(-r.payable) : money(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", gap: 18, marginTop: 12, flexWrap: "wrap" }}>
          <span className="muted">Último mês: <strong>{latest.label}</strong></span>
          <span className="muted">Faturamento: <strong>{compactMoney(latest.gross)}</strong></span>
          <span className="muted">Resultado: <strong>{money(latest.cashResult)}</strong></span>
          <span className="muted">Acumulado: <strong>{money(latest.cumulative)}</strong></span>
        </div>
      </div>
    </section>
  );
}
