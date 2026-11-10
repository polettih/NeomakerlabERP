"use client";
import { useState } from "react";

/** Seleção múltipla que sobrevive à troca de página e respeita os filtros atuais. */
export function useSelection(visibleIds: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Descarta ids que saíram da lista (excluídos ou fora do filtro).
  const visible = new Set(visibleIds);
  const effective = [...selected].filter((id) => visible.has(id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allChecked = visibleIds.length > 0 && effective.length === visibleIds.length;
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(visibleIds));
  const clear = () => setSelected(new Set());
  return {
    ids: effective,
    has: (id: string) => selected.has(id) && visible.has(id),
    toggle,
    toggleAll,
    allChecked,
    clear,
  };
}

/** Barra que aparece quando há itens selecionados. */
export function BulkBar({
  count,
  label,
  warning,
  onDelete,
  onClear,
  busy,
}: {
  count: number;
  label: string;
  warning: string;
  onDelete: () => void;
  onClear: () => void;
  busy: boolean;
}) {
  if (!count) return null;
  return (
    <div
      className="card"
      role="status"
      style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between" }}
    >
      <span>
        <strong>{count}</strong> {label} selecionado{count === 1 ? "" : "s"}
        <small className="muted"> — {warning}</small>
      </span>
      <span className="actions">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onClear}
          disabled={busy}
        >
          Limpar seleção
        </button>
        <button type="button" className="btn btn-danger btn-sm" onClick={onDelete} disabled={busy}>
          {busy ? "Excluindo..." : `Excluir ${count}`}
        </button>
      </span>
    </div>
  );
}

/** Confirmação forte: o usuário precisa digitar EXCLUIR. */
export function confirmBulk(count: number, what: string, extra: string) {
  const typed = window.prompt(
    `Excluir ${count} ${what} definitivamente? ${extra}\n\nEsta ação não pode ser desfeita. Digite EXCLUIR para confirmar.`
  );
  return typed?.trim().toUpperCase() === "EXCLUIR";
}
