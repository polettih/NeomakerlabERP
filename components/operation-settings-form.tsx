"use client";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { errorMessage } from "@/lib/errors";

export function OperationSettingsForm({
  initialLaborHourRate,
  initialEnergyCostKwh,
}: {
  initialLaborHourRate: number;
  initialEnergyCostKwh: number;
}) {
  const r = useRouter();
  const laborId = useId();
  const energyId = useId();
  const [laborRate, setLaborRate] = useState(String(initialLaborHourRate));
  const [energyCost, setEnergyCost] = useState(String(initialEnergyCostKwh));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    const labor = Number(laborRate);
    const energy = Number(energyCost);
    if (!Number.isFinite(labor) || labor < 0) return setError("Informe um valor de hora válido.");
    if (!Number.isFinite(energy) || energy < 0)
      return setError("Informe um custo de energia válido.");
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/operation-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labor_hour_rate: labor, energy_cost_kwh: energy }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Erro ao salvar.");
      setSaved(true);
      r.refresh();
    } catch (e) {
      setError(errorMessage(e, "Erro ao salvar configurações."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2>⚙️ Custos operacionais</h2>
      <p className="muted">
        Usados para calcular o custo estimado de produção em Produtos e o resultado em
        Financeiro.
      </p>
      <div className="form-grid">
        <div className="field">
          <label htmlFor={laborId}>Valor da hora de mão de obra (R$)</label>
          <input
            id={laborId}
            className="input"
            type="number"
            step="0.01"
            min="0"
            value={laborRate}
            onChange={(e) => setLaborRate(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor={energyId}>Custo de energia (R$/kWh)</label>
          <input
            id={energyId}
            className="input"
            type="number"
            step="0.0001"
            min="0"
            value={energyCost}
            onChange={(e) => setEnergyCost(e.target.value)}
          />
        </div>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <div className="actions">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>
          {busy ? "Salvando..." : "Salvar"}
        </button>
        {saved && !busy && <span className="muted">Salvo.</span>}
      </div>
    </div>
  );
}
