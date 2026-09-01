"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { errorMessage } from "@/lib/errors";

export type RecipeStep = { technique: string; paint: string; note: string };
export type Recipe = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  colors: string[] | null;
  dilution: string | null;
  finish: string | null;
  notes: string | null;
  steps: RecipeStep[] | null;
  product_name: string | null;
  product_thumb: string | null;
};

function RecipeCard({ r }: { r: Recipe }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const hasSteps = (r.steps?.length ?? 0) > 0;

  async function remove() {
    if (!confirm(`Excluir a receita "${r.name}"?`)) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/painting-recipes?id=${r.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(errorMessage(j.error, "Erro ao excluir."));
    } else router.refresh();
  }

  return (
    <div className="card recipe-card">
      <div className="section-title">
        <div className="product-name-cell">
          {r.product_thumb && <img className="product-thumb" src={r.product_thumb} alt="" />}
          <div>
            <strong>{r.name}</strong>
            <div className="muted">
              {r.category}
              {r.product_name ? ` · ${r.product_name}` : ""}
            </div>
          </div>
        </div>
        <button className="btn btn-danger btn-sm" onClick={remove} disabled={busy}>
          Excluir
        </button>
      </div>
      {error && <div className="error">{error}</div>}

      {hasSteps ? (
        <ol className="recipe-step-list">
          {r.steps!.map((s, i) => (
            <li key={i} className={checked[i] ? "recipe-step-done" : ""}>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={!!checked[i]}
                  onChange={(e) => setChecked((c) => ({ ...c, [i]: e.target.checked }))}
                />
                <span>
                  <strong>{s.technique}:</strong> {s.paint}
                  {s.note ? <span className="muted"> — {s.note}</span> : null}
                </span>
              </label>
            </li>
          ))}
        </ol>
      ) : (
        <>
          <p>{r.description || "Sem passo a passo cadastrado."}</p>
          {!!r.colors?.length && (
            <div className="muted">
              <strong>Cores:</strong> {r.colors.join(", ")}
            </div>
          )}
        </>
      )}

      <div className="recipe-card-footer">
        {r.finish && <span className="badge">{r.finish}</span>}
        {r.dilution && <span className="muted">Diluição: {r.dilution}</span>}
        {(r.notes || hasSteps) && (
          <button className="btn btn-secondary btn-sm" onClick={() => setOpen((o) => !o)}>
            {open ? "Ocultar detalhes" : "Mais detalhes"}
          </button>
        )}
      </div>
      {open && (
        <div className="recipe-card-details">
          {hasSteps && !!r.colors?.length && (
            <div className="muted">
              <strong>Cores usadas:</strong> {r.colors.join(", ")}
            </div>
          )}
          {r.notes && <p className="muted">{r.notes}</p>}
        </div>
      )}
      {hasSteps && Object.values(checked).some(Boolean) && (
        <button className="btn btn-secondary btn-sm" onClick={() => setChecked({})}>
          Reiniciar checklist
        </button>
      )}
    </div>
  );
}

export function RecipeLibrary({ recipes }: { recipes: Recipe[] }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(recipes.map((r) => r.category)))],
    [recipes]
  );

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return recipes.filter((r) => {
      if (category !== "all" && r.category !== category) return false;
      if (!term) return true;
      return (
        r.name.toLowerCase().includes(term) ||
        (r.product_name || "").toLowerCase().includes(term) ||
        (r.colors || []).some((c) => c.toLowerCase().includes(term)) ||
        (r.steps || []).some((s) => s.paint.toLowerCase().includes(term))
      );
    });
  }, [recipes, q, category]);

  return (
    <div className="card">
      <div className="section-title">
        <div>
          <h2>Minha biblioteca</h2>
          <p className="muted">
            {visible.length} de {recipes.length} receita{recipes.length === 1 ? "" : "s"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            className="input"
            placeholder="Buscar por nome, tinta ou produto"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ minWidth: 220 }}
            aria-label="Buscar receitas"
          />
          <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === "all" ? "Todas as categorias" : c}
              </option>
            ))}
          </select>
        </div>
      </div>
      {!recipes.length && (
        <p className="muted">
          Sua biblioteca ainda está vazia. Adicione uma receita inicial ao lado ou crie a sua.
        </p>
      )}
      {!!recipes.length && !visible.length && (
        <p className="muted">Nenhuma receita encontrada para essa busca.</p>
      )}
      <div className="recipe-grid">
        {visible.map((r) => (
          <RecipeCard key={r.id} r={r} />
        ))}
      </div>
    </div>
  );
}
