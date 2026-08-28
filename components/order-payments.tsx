"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/format";
import { errorMessage } from "@/lib/errors";

export type Payment = {
  id: string;
  order_id: string | null;
  amount: number;
  payment_method: string;
  payment_date: string;
};

const METHOD_LABEL: Record<string, string> = {
  pix: "Pix",
  cash: "Dinheiro",
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  bank_transfer: "Transferência",
  marketplace: "Repasse do marketplace",
  other: "Outro",
};

const fmt = (d: string) => new Date(d).toLocaleDateString("pt-BR");

export function OrderPayments({ payments }: { payments: Payment[] }) {
  const r = useRouter();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  if (!payments.length) return null;

  async function remove(id: string) {
    if (!confirm("Excluir este pagamento? O status do pedido será recalculado.")) return;
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`/api/payments/${id}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Erro ao excluir pagamento.");
      r.refresh();
    } catch (e) {
      setError(errorMessage(e, "Erro ao excluir pagamento."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Ocultar" : "Ver"} pagamentos ({payments.length})
      </button>
      {open && (
        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {payments.map((p) => (
            <div
              key={p.id}
              style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}
            >
              <span>
                {money(Number(p.amount))} · {METHOD_LABEL[p.payment_method] ?? p.payment_method} ·{" "}
                {fmt(p.payment_date)}
              </span>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                disabled={busyId === p.id}
                onClick={() => remove(p.id)}
                title="Excluir pagamento"
              >
                {busyId === p.id ? "..." : "✕"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
