"use client";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { money, n } from "@/lib/format";
import { errorMessage } from "@/lib/errors";
type Material = {
  id: string;
  name: string;
  category: string;
  material_type: string;
  unit: string;
  quantity_on_hand: number;
  minimum_stock: number;
  average_cost: number;
  supplier?: string;
  color_name?: string;
  color_hex?: string;
  active?: boolean;
};
const typeUnit = (t: string) => (t === "Filamento" ? "g" : t === "Resina" ? "ml" : "un");
export function InventoryManager({ materials }: { materials: Material[] }) {
  const r = useRouter();
  const empty = {
    name: "",
    category: "Insumos",
    material_type: "Filamento",
    unit: "g",
    color_name: "",
    color_hex: "#808080",
    minimum_stock: "0",
    supplier: "",
  };
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<Material | null>(null);
  const [purchase, setPurchase] = useState({
    material_id: materials[0]?.id || "",
    quantity: "",
    total_cost: "",
    supplier: "",
    notes: "",
  });
  const [use, setUse] = useState({
    material_id: materials[0]?.id || "",
    quantity: "",
    description: "",
    direction: "out" as "out" | "in",
  });
  const [filter, setFilter] = useState("Todos");
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return materials.filter((m) => {
      if (filter !== "Todos" && m.material_type !== filter) return false;
      if (!term) return true;
      return (
        m.name.toLowerCase().includes(term) ||
        (m.supplier ?? "").toLowerCase().includes(term) ||
        (m.color_name ?? "").toLowerCase().includes(term)
      );
    });
  }, [materials, filter, q]);
  function updateForm(k: string, v: string) {
    const next = { ...form, [k]: v } as typeof form;
    if (k === "material_type") next.unit = typeUnit(v);
    setForm(next);
  }
  function startEdit(m: Material) {
    setEditing(m);
    setForm({
      name: m.name,
      category: m.category,
      material_type: m.material_type,
      unit: m.unit,
      color_name: m.color_name || "",
      color_hex: m.color_hex || "#808080",
      minimum_stock: String(m.minimum_stock || 0),
      supplier: m.supplier || "",
    });
    setError("");
  }
  function cancelEdit() {
    setEditing(null);
    setForm(empty);
    setError("");
  }
  async function send(url: string, method: string, body: Record<string, unknown>) {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || "Erro");
    return j;
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await send(
        "/api/materials",
        editing ? "PATCH" : "POST",
        editing ? { ...form, id: editing.id } : { ...form }
      );
      cancelEdit();
      r.refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function remove(m: Material) {
    if (
      !confirm(
        `Excluir "${m.name}"? Ele ficará oculto de novos lançamentos, preservando o histórico.`
      )
    )
      return;
    try {
      await send("/api/materials", "DELETE", { id: m.id });
      r.refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function buy(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await send("/api/material-purchases", "POST", purchase);
      setPurchase({ ...purchase, quantity: "", total_cost: "", notes: "" });
      r.refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function consume(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const qty = Math.abs(Number(use.quantity));
      await send("/api/stock-movements", "POST", {
        material_id: use.material_id,
        description: use.description,
        quantity: use.direction === "out" ? -qty : qty,
        // "adjustment" não mexe no custo médio, diferente de uma compra — correto
        // para corrigir contagem de estoque sem distorcer o custo dos materiais.
        movement_type: use.direction === "out" ? "manual_consumption" : "adjustment",
      });
      setUse({ ...use, quantity: "", description: "" });
      r.refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  const selected = materials.find((m) => m.id === purchase.material_id);
  return (
    <div className="grid" style={{ gap: 18 }}>
      {error && <div className="error">{error}</div>}
      <div className="section-title">
        <div>
          <h2>📦 Gestão de estoque e compras</h2>
          <p className="muted">Cadastre, compre, consuma e corrija materiais em um único fluxo.</p>
        </div>
        <div className="filters-row">
          <input
            className="input"
            placeholder="Buscar material, cor ou fornecedor"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button
            type="button"
            className={`btn ${filter === "Todos" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setFilter("Todos")}
          >
            Todos
          </button>
          <button
            type="button"
            className={`btn ${filter === "Filamento" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setFilter("Filamento")}
          >
            Filamentos
          </button>
          <button
            type="button"
            className={`btn ${filter === "Resina" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setFilter("Resina")}
          >
            Resinas
          </button>
          <button
            type="button"
            className={`btn ${filter === "Outro" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setFilter("Outro")}
          >
            Outros
          </button>
        </div>
      </div>
      <div className="grid two-col">
        <form className="card grid" onSubmit={save}>
          <div className="section-title">
            <h2>{editing ? "✏️ Editar material" : "＋ Novo material"}</h2>
            {editing && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={cancelEdit}>
                Cancelar
              </button>
            )}
          </div>
          <div className="field">
            <label>Nome / marca</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => updateForm("name", e.target.value)}
              placeholder="Ex.: PLA Matte"
              required
            />
          </div>
          <div className="form-grid">
            <div className="field">
              <label>Tipo</label>
              <select
                className="select"
                value={form.material_type}
                onChange={(e) => updateForm("material_type", e.target.value)}
              >
                <option>Filamento</option>
                <option>Resina</option>
                <option>Outro</option>
              </select>
            </div>
            <div className="field">
              <label>Categoria</label>
              <select
                className="select"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option>Insumos</option>
                <option>Ferramentas</option>
                <option>Maquinários</option>
              </select>
            </div>
            <div className="field">
              <label>Unidade</label>
              <input className="input" value={form.unit} readOnly />
            </div>
            <div className="field">
              <label>Estoque mínimo</label>
              <input
                className="input"
                type="number"
                step="0.001"
                min="0"
                value={form.minimum_stock}
                onChange={(e) => setForm({ ...form, minimum_stock: e.target.value })}
              />
            </div>
          </div>
          {form.material_type !== "Outro" && (
            <div className="form-grid">
              <div className="field">
                <label>Cor</label>
                <input
                  className="input"
                  value={form.color_name}
                  onChange={(e) => setForm({ ...form, color_name: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label>Cor visual</label>
                <input
                  className="input"
                  type="color"
                  value={form.color_hex}
                  onChange={(e) => setForm({ ...form, color_hex: e.target.value })}
                  style={{ height: 42, padding: 4 }}
                />
              </div>
            </div>
          )}
          <div className="field">
            <label>Fornecedor</label>
            <input
              className="input"
              value={form.supplier}
              onChange={(e) => setForm({ ...form, supplier: e.target.value })}
            />
          </div>
          <button className="btn btn-primary">
            {editing ? "Salvar alterações" : "Cadastrar material"}
          </button>
        </form>
        <div className="grid">
          <form className="card grid" onSubmit={buy}>
            <h2>🛒 Registrar compra</h2>
            <div className="field">
              <label>Material</label>
              <select
                className="select"
                required
                value={purchase.material_id}
                onChange={(e) => setPurchase({ ...purchase, material_id: e.target.value })}
              >
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.color_name ? ` — ${m.color_name}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-grid">
              <div className="field">
                <label>Quantidade ({selected?.unit || "un"})</label>
                <input
                  className="input"
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={purchase.quantity}
                  onChange={(e) => setPurchase({ ...purchase, quantity: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label>Valor pago</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={purchase.total_cost}
                  onChange={(e) => setPurchase({ ...purchase, total_cost: e.target.value })}
                  required
                />
              </div>
            </div>
            <p className="muted">
              Custo:{" "}
              {purchase.quantity && purchase.total_cost
                ? money(n(purchase.total_cost) / n(purchase.quantity))
                : `R$ 0,00`}
              /{selected?.unit || "un"}
            </p>
            <button className="btn btn-primary" disabled={!materials.length}>
              Adicionar ao estoque
            </button>
          </form>
          <form className="card grid" onSubmit={consume}>
            <div className="section-title">
              <h2>{use.direction === "out" ? "➖ Consumo" : "➕ Ajuste de estoque"}</h2>
              <div className="actions">
                <button
                  type="button"
                  className={`btn btn-sm ${use.direction === "out" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setUse({ ...use, direction: "out" })}
                >
                  Baixar
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${use.direction === "in" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setUse({ ...use, direction: "in" })}
                >
                  Adicionar
                </button>
              </div>
            </div>
            <div className="field">
              <label>Material</label>
              <select
                className="select"
                required
                value={use.material_id}
                onChange={(e) => setUse({ ...use, material_id: e.target.value })}
              >
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.color_name ? ` — ${m.color_name}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{use.direction === "out" ? "Quantidade consumida" : "Quantidade a adicionar"}</label>
              <input
                className="input"
                type="number"
                step="0.001"
                min="0.001"
                value={use.quantity}
                onChange={(e) => setUse({ ...use, quantity: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label>Motivo</label>
              <input
                className="input"
                value={use.description}
                onChange={(e) => setUse({ ...use, description: e.target.value })}
                placeholder={
                  use.direction === "out"
                    ? "Teste, impressão perdida, manutenção..."
                    : "Contagem de inventário, devolução, correção..."
                }
              />
            </div>
            <button className="btn btn-secondary" disabled={!materials.length}>
              {use.direction === "out" ? "Baixar material" : "Adicionar ao estoque"}
            </button>
          </form>
        </div>
      </div>
      <div className="card table-wrap">
        <div className="section-title">
          <div>
            <h2>Estoque atual</h2>
            <p className="muted">Edite ou desative registros feitos incorretamente.</p>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Material</th>
              <th>Tipo</th>
              <th>Cor</th>
              <th>Estoque</th>
              <th>Custo</th>
              <th>Valor</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id}>
                <td>
                  <strong>{m.name}</strong>
                </td>
                <td>{m.material_type}</td>
                <td>
                  {m.material_type !== "Outro" ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                      <span
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          background: m.color_hex || "#888",
                          border: "1px solid #999",
                        }}
                      ></span>
                      {m.color_name || "-"}
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
                <td>
                  {n(m.quantity_on_hand).toLocaleString("pt-BR", { maximumFractionDigits: 3 })}{" "}
                  {m.unit}
                </td>
                <td>
                  {money(n(m.average_cost))}/{m.unit}
                </td>
                <td>{money(n(m.quantity_on_hand) * n(m.average_cost))}</td>
                <td>
                  <span
                    className={`badge ${n(m.quantity_on_hand) <= n(m.minimum_stock) ? "yellow" : "green"}`}
                  >
                    {n(m.quantity_on_hand) <= n(m.minimum_stock) ? "Baixo" : "Normal"}
                  </span>
                </td>
                <td>
                  <div className="actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => startEdit(m)}>
                      Editar
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => remove(m)}>
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={8} className="muted">
                  Nenhum material cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
