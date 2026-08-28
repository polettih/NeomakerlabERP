"use client";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { errorMessage } from "@/lib/errors";

const METHOD_LABEL: Record<string, string> = {
  pix: "Pix",
  cash: "Dinheiro",
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  bank_transfer: "Transferência",
  marketplace: "Repasse do marketplace",
  other: "Outro",
};

export function RegisterPaymentButton({
  orderId,
  remaining,
}: {
  orderId: string;
  remaining: number;
}) {
  const r = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(remaining > 0 ? remaining.toFixed(2) : "");
  const [method, setMethod] = useState("pix");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const amountId = useId();
  const methodId = useId();

  async function submit() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Informe um valor válido.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, amount: value, payment_method: method }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Erro ao registrar pagamento.");
      setOpen(false);
      r.refresh();
    } catch (e) {
      setError(errorMessage(e, "Erro ao registrar pagamento."));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>
        💰 Registrar pagamento
      </button>
    );
  }

  return (
    <div className="card" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8, minWidth: 220 }}>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <div className="field">
        <label htmlFor={amountId}>Valor recebido</label>
        <input
          id={amountId}
          className="input"
          type="number"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          autoFocus
        />
      </div>
      <div className="field">
        <label htmlFor={methodId}>Forma de pagamento</label>
        <select id={methodId} className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
          {Object.entries(METHOD_LABEL).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={submit}>
          {busy ? "Salvando..." : "Confirmar"}
        </button>
        <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
