"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function ProductActions({ id, active }: { id: string; active: boolean }) {
  const [busy, setBusy] = useState(false);
  const r = useRouter();
  async function patch(body: { active: boolean }) {
    setBusy(true);
    const res = await fetch(`/api/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) alert(j.error || "Erro");
    else r.refresh();
  }
  async function remove() {
    if (
      !confirm(
        "Excluir este produto? Produtos usados em pedidos manterão o nome salvo no pedido, mas o produto será removido do catálogo."
      )
    )
      return;
    setBusy(true);
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) alert(j.error || "Erro");
    else r.refresh();
  }
  return (
    <div className="actions">
      <button
        className="btn btn-secondary btn-sm"
        disabled={busy}
        onClick={() => patch({ active: !active })}
      >
        {active ? "Desativar" : "Ativar"}
      </button>
      <button className="btn btn-danger btn-sm" disabled={busy} onClick={remove}>
        Excluir
      </button>
    </div>
  );
}
