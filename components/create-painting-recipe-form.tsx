"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { errorMessage } from "@/lib/errors";

export type RecipeStep = { technique: string; paint: string; note: string };
const TECHNIQUES = ["Base", "Camada", "Wash", "Drybrush", "Luz", "Sombra", "Detalhe", "Verniz"];
const blankStep = (): RecipeStep => ({ technique: "Base", paint: "", note: "" });

export function CreatePaintingRecipeForm({
  products,
}: {
  products: { id: string; name: string }[];
}) {
  const r = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Geral");
  const [finish, setFinish] = useState("Fosco");
  const [notes, setNotes] = useState("");
  const [productId, setProductId] = useState("");
  const [steps, setSteps] = useState<RecipeStep[]>([blankStep()]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function updateStep(i: number, patch: Partial<RecipeStep>) {
    setSteps((s) => s.map((st, idx) => (idx === i ? { ...st, ...patch } : st)));
  }
  function addStep() {
    setSteps((s) => [...s, blankStep()]);
  }
  function removeStep(i: number) {
    setSteps((s) => s.filter((_, idx) => idx !== i));
  }
  function moveStep(i: number, dir: -1 | 1) {
    setSteps((s) => {
      const j = i + dir;
      if (j < 0 || j >= s.length) return s;
      const next = [...s];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function resetForm() {
    setName("");
    setNotes("");
    setProductId("");
    setSteps([blankStep()]);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const cleanSteps = steps
      .map((s) => ({ ...s, paint: s.paint.trim(), note: s.note.trim() }))
      .filter((s) => s.paint);
    if (!name.trim()) return setError("Dê um nome pra receita.");
    if (!cleanSteps.length) return setError("Adicione pelo menos um passo com o nome da tinta.");
    setBusy(true);
    try {
      const res = await fetch("/api/painting-recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category,
          finish,
          notes,
          product_id: productId || null,
          steps: cleanSteps,
          colors: cleanSteps.map((s) => s.paint),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Erro ao salvar receita.");
      resetForm();
      setOpen(false);
      r.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        + Nova receita
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="card grid">
      <div className="section-title">
        <h2>Nova receita</h2>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => {
            resetForm();
            setOpen(false);
          }}
        >
          Cancelar
        </button>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="field">
        <label>Nome</label>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Ex.: Pele clara - Cammy"
        />
      </div>
      <div className="form-grid">
        <div className="field">
          <label>Categoria</label>
          <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
            {["Geral", "Pele", "Cabelo", "Cores", "Sombras", "Luzes", "Metal", "Materiais"].map(
              (x) => (
                <option key={x}>{x}</option>
              )
            )}
          </select>
        </div>
        <div className="field">
          <label>Acabamento final</label>
          <select className="select" value={finish} onChange={(e) => setFinish(e.target.value)}>
            <option>Fosco</option>
            <option>Acetinado</option>
            <option>Brilhante</option>
            <option>Metálico</option>
          </select>
        </div>
        <div className="field">
          <label>Produto relacionado</label>
          <select
            className="select"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            <option value="">Nenhum</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label>Passo a passo</label>
        <div className="recipe-steps-editor">
          {steps.map((s, i) => (
            <div className="recipe-step-row" key={i}>
              <span className="recipe-step-num">{i + 1}</span>
              <select
                className="select"
                value={s.technique}
                onChange={(e) => updateStep(i, { technique: e.target.value })}
              >
                {TECHNIQUES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <input
                className="input"
                placeholder="Tinta/cor (ex.: Vermelho Sangue)"
                value={s.paint}
                onChange={(e) => updateStep(i, { paint: e.target.value })}
              />
              <input
                className="input"
                placeholder="Nota (opcional)"
                value={s.note}
                onChange={(e) => updateStep(i, { note: e.target.value })}
              />
              <div className="recipe-step-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => moveStep(i, -1)}
                  disabled={i === 0}
                  title="Mover pra cima"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => moveStep(i, 1)}
                  disabled={i === steps.length - 1}
                  title="Mover pra baixo"
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => removeStep(i)}
                  disabled={steps.length === 1}
                  title="Remover passo"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-secondary" onClick={addStep} style={{ marginTop: 8 }}>
          + Adicionar passo
        </button>
      </div>

      <div className="field">
        <label>Observações gerais</label>
        <textarea
          className="textarea"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Número de camadas, tempo de secagem, cuidados..."
        />
      </div>
      <button className="btn btn-primary" disabled={busy}>
        {busy ? "Salvando..." : "Salvar receita"}
      </button>
    </form>
  );
}
