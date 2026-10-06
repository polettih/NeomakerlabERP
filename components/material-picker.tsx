"use client";
import { useEffect, useMemo, useRef, useState } from "react";

type PickerMaterial = {
  id: string;
  name: string;
  color_name?: string | null;
  unit: string;
  average_cost: number | string;
};

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Campo de busca com autocompletar para escolher um material. Substitui o
 * <select> simples: digita algumas letras do nome/cor e a lista já filtra,
 * em vez de abrir um dropdown nativo com dezenas de itens pra rolar.
 */
export function MaterialPicker({
  materials,
  value,
  onChange,
  placeholder = "Buscar material...",
  emptyLabel = "Nenhum material encontrado",
  onEnterWithSelection,
}: {
  materials: PickerMaterial[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  emptyLabel?: string;
  /** Chamado quando o usuário aperta Enter já com um item escolhido (não navegando a lista) — útil para pular direto pro campo de quantidade. */
  onEnterWithSelection?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const selected = materials.find((m) => m.id === value);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return materials;
    return materials.filter((m) => `${m.name} ${m.color_name || ""}`.toLowerCase().includes(q));
  }, [materials, query]);

  function pick(m: PickerMaterial) {
    onChange(m.id);
    setQuery("");
    setOpen(false);
  }

  const displayValue = open
    ? query
    : selected
      ? `${selected.name}${selected.color_name ? ` — ${selected.color_name}` : ""}`
      : "";

  return (
    <div className="material-picker" ref={wrapRef}>
      <input
        className="input"
        placeholder={placeholder}
        value={displayValue}
        onFocus={() => {
          setOpen(true);
          setQuery("");
          setHighlight(0);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlight(0);
          if (!open) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (!open) {
            if (e.key === "ArrowDown" || e.key === "Enter") {
              setOpen(true);
              setQuery("");
            }
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, filtered.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (filtered[highlight]) {
              pick(filtered[highlight]);
              onEnterWithSelection?.();
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && (
        <div className="material-picker-dropdown">
          {filtered.length === 0 && <div className="material-picker-empty">{emptyLabel}</div>}
          {filtered.map((m, i) => (
            <div
              key={m.id}
              className={`material-picker-item ${i === highlight ? "material-picker-item-active" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(m);
              }}
              onMouseEnter={() => setHighlight(i)}
            >
              <span>
                {m.name}
                {m.color_name ? ` — ${m.color_name}` : ""}
              </span>
              <span className="muted">
                {money(Number(m.average_cost))}/{m.unit}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
