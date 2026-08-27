"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function OrderDeleteButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const r = useRouter();
  async function remove() {
    if (
      !confirm(
        "Excluir este pedido definitivamente? Pagamentos serão excluídos e materiais consumidos pela produção serão estornados ao estoque."
      )
    )
      return;
    setBusy(true);
    const res = await fetch(`/api/orders/${id}`, { method: "DELETE" });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) {
      alert(j.error || "Não foi possível excluir o pedido.");
      return;
    }
    r.refresh();
  }
  return (
    <button className="btn btn-danger btn-sm" disabled={busy} onClick={remove}>
      {busy ? "Excluindo..." : "Excluir"}
    </button>
  );
}
