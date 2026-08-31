"use client";
import { useState } from "react";
import Link from "next/link";
import { money } from "@/lib/format";
import type { FinanceCategoryRow } from "@/lib/types";
export function FinanceTabs({
  summary,
  rows,
  fees,
  labor,
  spent,
  initialLaborHourRate,
}: {
  summary: { qty: number; gross: number; received: number; receivable: number; profit: number };
  rows: FinanceCategoryRow[];
  fees: { total: number; count: number };
  labor: { total: number; items: number };
  spent: number;
  initialLaborHourRate: number;
}) {
  const [tab, setTab] = useState<"sales" | "fees" | "labor">("sales");
  const savedRate = initialLaborHourRate;
  return (
    <>
      <div className="tabs" style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        <button
          className={`btn ${tab === "sales" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setTab("sales")}
        >
          💰 Vendas
        </button>
        <button
          className={`btn ${tab === "fees" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setTab("fees")}
        >
          🏷️ Taxas do marketplace
        </button>
        <button
          className={`btn ${tab === "labor" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setTab("labor")}
        >
          🛠️ Mão de obra
        </button>
      </div>
      {tab === "sales" && (
        <>
          <div className="grid cards">
            <div className="card">
              <div className="label">Itens vendidos</div>
              <div className="value">{summary.qty}</div>
            </div>
            <div className="card">
              <div className="label">Vendas</div>
              <div className="value">{money(summary.gross)}</div>
            </div>
            <div className="card">
              <div className="label">Valor recebido</div>
              <div className="value kpi-green">{money(summary.received)}</div>
            </div>
            <div className="card">
              <div className="label">A receber das vendas</div>
              <div className="value kpi-yellow">{money(summary.receivable)}</div>
            </div>
            <div className="card">
              <div className="label">Lucro líquido das vendas</div>
              <div className="value">{money(summary.profit)}</div>
              <p className="muted" style={{ marginTop: 4 }}>
                Vendas − custo do produto − taxas − frete − mão de obra.
              </p>
            </div>
            <div className="card">
              <div className="label">Despesas administrativas pagas</div>
              <div className="value">{money(spent)}</div>
              <p className="muted" style={{ marginTop: 4 }}>
                Aluguel, marketing, assinaturas etc. (não inclui compra de material nem
                equipamentos, já contabilizados no custo do produto e no fluxo de caixa).
              </p>
            </div>
            <div className="card">
              <div className="label">Resultado líquido do período</div>
              <div className={`value ${summary.profit - spent < 0 ? "error" : ""}`}>
                {money(summary.profit - spent)}
              </div>
            </div>
          </div>
          <div className="card" style={{ marginTop: 18 }}>
            <h2>Vendas por categoria</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Categoria</th>
                    <th>Itens</th>
                    <th>Vendas</th>
                    <th>Recebido</th>
                    <th>Taxas</th>
                    <th>Frete</th>
                    <th>Mão de obra</th>
                    <th>Lucro líquido</th>
                    <th>A receber</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.category}>
                      <td>
                        <strong>{r.category}</strong>
                      </td>
                      <td>{r.qty}</td>
                      <td>{money(r.merchandise)}</td>
                      <td>{money(r.received)}</td>
                      <td>{money(r.fees)}</td>
                      <td>{money(r.shipping)}</td>
                      <td>{money(r.labor)}</td>
                      <td>{money(r.merchandise - r.cost - r.fees - r.shipping - r.labor)}</td>
                      <td>{money(r.receivable)}</td>
                    </tr>
                  ))}
                  {!rows.length && (
                    <tr>
                      <td colSpan={9} className="muted">
                        Ainda não existem vendas para consolidar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      {tab === "fees" && (
        <div className="grid cards">
          <div className="card">
            <div className="label">Total gasto em taxas do marketplace</div>
            <div className="value">{money(fees.total)}</div>
          </div>
          <div className="card">
            <div className="label">Pedidos com taxa</div>
            <div className="value">{fees.count}</div>
          </div>
          <div className="card">
            <div className="label">Taxa média por pedido</div>
            <div className="value">{money(fees.count ? fees.total / fees.count : 0)}</div>
          </div>
          <div className="card">
            <div className="label">Participação nas vendas</div>
            <div className="value">
              {summary.gross ? ((fees.total / summary.gross) * 100).toFixed(2) + "%" : "0,00%"}
            </div>
          </div>
        </div>
      )}
      {tab === "labor" && (
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <div className="card">
            <h2>🛠️ Valor da mão de obra</h2>
            <p className="muted">
              Usado automaticamente na precificação dos produtos e no cálculo de lucro.
            </p>
            <p className="muted">
              Valor atual: <strong>{money(savedRate)}</strong>/hora.{" "}
              <Link href="/configuracoes">Editar em Configurações →</Link>
            </p>
          </div>
          <div className="grid cards">
            <div className="card">
              <div className="label">Valor arrecadado de mão de obra</div>
              <div className="value">{money(labor.total)}</div>
              <p className="muted">Soma da mão de obra calculada nos produtos vendidos.</p>
            </div>
            <div className="card">
              <div className="label">Itens vendidos com mão de obra</div>
              <div className="value">{labor.items}</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
