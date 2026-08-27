"use client";

type HistoryRow = { key: string; label: string; gross: number; received: number; receivable: number; purchases: number; expenses: number; equipment: number; outflow: number; cashResult: number; cumulative: number; payable: number; payableDue: number };
const money = (value: number) => { const abs = Math.abs(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); return value < 0 ? `R$ - ${abs.replace(/^R\$\s?/, "")}` : abs; };
const compact = (value: number) => { const a = Math.abs(value); if (a >= 1e6) return `R$ ${(a / 1e6).toFixed(1)} mi`; if (a >= 1e3) return `R$ ${(a / 1e3).toFixed(1)} mil`; return `R$ ${Math.round(a)}`; };

export function FinancialHistory({ rows, totalPayable, totalReceivable, totalOutflow, totalGross, totalReceived }: { rows: HistoryRow[]; totalPayable: number; totalReceivable: number; totalOutflow: number; totalGross: number; totalReceived: number }) {
  if (!rows.length) return <div className="card" style={{ marginTop: 18 }}><h2>Histórico financeiro</h2><p className="muted">Ainda não existem movimentações para montar o histórico.</p></div>;
  const maxMonthly = Math.max(1, ...rows.flatMap(r => [r.gross, r.received, r.outflow]));
  const maxAbsCumulative = Math.max(1, ...rows.map(r => Math.abs(r.cumulative)));
  const latest = rows[rows.length - 1];
  const breakEven = rows.find(r => r.cumulative >= 0);
  const recovery = totalOutflow > 0 ? Math.min(100, totalReceived / totalOutflow * 100) : 100;
  return <section style={{ marginTop: 18 }}>
    <div className="section-title"><div><h2>Gestão financeira e controle de caixa</h2><p className="muted">Histórico mensal desde a primeira movimentação, com visão de faturamento, caixa, dívida e recuperação do dinheiro investido.</p></div></div>
    <div className="grid four-col">
      <div className="card"><span className="muted">Faturamento acumulado</span><h2>{money(totalGross)}</h2></div>
      <div className="card"><span className="muted">Recebido acumulado</span><h2>{money(totalReceived)}</h2></div>
      <div className="card"><span className="muted">Saídas acumuladas</span><h2>{money(totalOutflow)}</h2></div>
      <div className="card"><span className="muted">Recuperação</span><h2>{recovery.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</h2></div>
    </div>
    <div className="grid two-col" style={{ marginTop: 12 }}>
      <div className="card"><span className="muted">Dívida / contas a pagar</span><h2 className={totalPayable > 0 ? "error" : ""}>{totalPayable > 0 ? money(-totalPayable) : money(0)}</h2><small className="muted">Somente obrigações ainda não pagas</small></div>
      <div className="card"><span className="muted">A receber</span><h2>{money(totalReceivable)}</h2><small className="muted">Vendas válidas ainda não recebidas</small></div>
    </div>

    <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 18 }}>
      <div className="card"><div className="section-title"><div><h3>Faturamento × entradas × saídas</h3><p className="muted">Faturamento é a venda registrada; entrada é dinheiro efetivamente recebido.</p></div></div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 240, overflowX: "auto", padding: "12px 4px 0" }}>
          {rows.map(r => <div key={r.key} title={`${r.label} | Faturamento ${money(r.gross)} | Recebido ${money(r.received)} | Saídas ${money(r.outflow)}`} style={{ minWidth: 72, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 195 }}><div style={{ width: 16, height: `${Math.max(2, r.gross / maxMonthly * 100)}%`, background: "#4ade80", borderRadius: "4px 4px 0 0" }} /><div style={{ width: 16, height: `${Math.max(2, r.received / maxMonthly * 100)}%`, background: "#60a5fa", borderRadius: "4px 4px 0 0" }} /><div style={{ width: 16, height: `${Math.max(2, r.outflow / maxMonthly * 100)}%`, background: "#ff4b4b", borderRadius: "4px 4px 0 0" }} /></div><span className="muted" style={{ fontSize: 11, marginTop: 7, whiteSpace: "nowrap" }}>{r.label}</span>
          </div>)}
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 12, flexWrap: "wrap" }}><span>🟩 Faturamento</span><span>🟦 Recebido</span><span>🟥 Saídas</span></div>
      </div>
      <div className="card"><div className="section-title"><div><h3>Saldo de caixa acumulado</h3><p className="muted">Quanto sobra ou falta depois de todas as saídas efetivamente pagas.</p></div></div>
        <div style={{ height: 240, display: "flex", alignItems: "center", gap: 9, overflowX: "auto", position: "relative", padding: "0 5px" }}><div style={{ position: "absolute", left: 0, right: 0, top: "50%", borderTop: "1px dashed var(--border, #2b313a)" }} />
          {rows.map(r => { const positive = r.cumulative >= 0; const h = Math.max(4, Math.min(95, Math.abs(r.cumulative) / maxAbsCumulative * 95)); return <div key={r.key} title={`${r.label}: ${money(r.cumulative)}`} style={{ minWidth: 48, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: positive ? "flex-start" : "flex-end", position: "relative", zIndex: 1 }}><div style={{ width: 22, height: `${h}%`, background: positive ? "#4ade80" : "#ff4b4b", borderRadius: 5, marginTop: positive ? 0 : "auto", marginBottom: positive ? "auto" : 0 }} /><span className="muted" style={{ position: "absolute", bottom: 0, fontSize: 10, whiteSpace: "nowrap" }}>{r.label}</span></div>; })}
        </div>
        <div className="grid two-col" style={{ marginTop: 14 }}><div><span className="muted">Saldo atual</span><h3 className={latest.cumulative < 0 ? "error" : ""}>{money(latest.cumulative)}</h3></div><div><span className="muted">Ponto de equilíbrio</span><h3>{breakEven ? breakEven.label : "Ainda não atingido"}</h3></div></div>
      </div>
    </div>

    <div className="card" style={{ marginTop: 18 }}><div className="section-title"><div><h3>Histórico mensal</h3><p className="muted">O saldo acumulado é baseado em caixa: recebimentos menos saídas pagas. A pagar e a receber são saldos de fechamento de cada mês.</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>Mês</th><th>Faturamento</th><th>Recebido</th><th>A receber</th><th>Compras</th><th>Despesas</th><th>Equipamentos</th><th>Saídas</th><th>Resultado caixa</th><th>Saldo acumulado</th><th>A pagar</th></tr></thead><tbody>{rows.map(r => <tr key={r.key}><td>{r.label}</td><td>{money(r.gross)}</td><td>{money(r.received)}</td><td>{money(r.receivable)}</td><td>{money(r.purchases)}</td><td>{money(r.expenses)}</td><td>{money(r.equipment)}</td><td>{money(r.outflow)}</td><td className={r.cashResult < 0 ? "error" : ""}>{money(r.cashResult)}</td><td className={r.cumulative < 0 ? "error" : ""}>{money(r.cumulative)}</td><td className={r.payable > 0 ? "error" : ""}>{r.payable > 0 ? money(-r.payable) : money(0)}</td></tr>)}</tbody></table></div>
      <div style={{ display: "flex", gap: 18, marginTop: 12, flexWrap: "wrap" }}><span className="muted">Último mês: <strong>{latest.label}</strong></span><span className="muted">Faturamento: <strong>{compact(latest.gross)}</strong></span><span className="muted">Resultado caixa: <strong>{money(latest.cashResult)}</strong></span><span className="muted">Saldo: <strong>{money(latest.cumulative)}</strong></span></div>
    </div>
  </section>;
}
