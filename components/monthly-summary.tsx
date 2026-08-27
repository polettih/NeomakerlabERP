"use client";

type Month = {
  label: string;
  gross: number;
  received: number;
  expensesPaid: number;
  result: number;
};

const money = (value: number) => {
  const abs = Math.abs(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return value < 0 ? `R$ - ${abs.replace(/^R\$\s?/, "")}` : abs;
};

function delta(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function DeltaTag({
  current,
  previous,
  invert,
}: {
  current: number;
  previous: number;
  invert?: boolean;
}) {
  const d = delta(current, previous);
  const good = invert ? d <= 0 : d >= 0;
  const sign = d > 0 ? "+" : "";
  return (
    <small className={good ? "kpi-green" : "error"} style={{ marginLeft: 8 }}>
      {sign}
      {d.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% vs. mês anterior
    </small>
  );
}

export function MonthlySummary({ current, previous }: { current: Month; previous: Month | null }) {
  return (
    <div className="card" style={{ marginTop: 18 }}>
      <div className="section-title">
        <div>
          <h2>Resumo do mês — {current.label}</h2>
          <p className="muted">
            {previous
              ? `Comparado a ${previous.label}.`
              : "Ainda não há mês anterior para comparar."}
          </p>
        </div>
      </div>
      <div className="grid four-col">
        <div className="card">
          <span className="muted">Faturamento</span>
          <h2>{money(current.gross)}</h2>
          {previous && <DeltaTag current={current.gross} previous={previous.gross} />}
        </div>
        <div className="card">
          <span className="muted">Recebido</span>
          <h2 className="kpi-green">{money(current.received)}</h2>
          {previous && <DeltaTag current={current.received} previous={previous.received} />}
        </div>
        <div className="card">
          <span className="muted">Saídas pagas</span>
          <h2>{money(current.expensesPaid)}</h2>
          <small className="muted">Compras + despesas + equipamentos</small>
          {previous && (
            <DeltaTag current={current.expensesPaid} previous={previous.expensesPaid} invert />
          )}
        </div>
        <div className="card">
          <span className="muted">Resultado de caixa</span>
          <h2 className={current.result < 0 ? "error" : ""}>{money(current.result)}</h2>
          {previous && <DeltaTag current={current.result} previous={previous.result} />}
        </div>
      </div>
    </div>
  );
}
