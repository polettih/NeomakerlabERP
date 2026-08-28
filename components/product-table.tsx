"use client";
import { useMemo, useState } from "react";
import { ProductActions } from "@/components/product-actions";
import { ProductEditor, type Material, type Machine } from "@/components/product-editor";
import { money } from "@/lib/format";

type Img = { id: string; public_url: string; storage_path: string; sort_order: number };
type Product = {
  id: string;
  name: string;
  sku: string | null;
  sale_price: number;
  estimated_cost: number;
  active: boolean;
  category: string | null;
  created_at: string;
  product_images: Img[] | null;
};

export function ProductTable({
  products,
  materials,
  machines,
  laborHourRate,
  energyCostKwh,
}: {
  products: Product[];
  materials: Material[];
  machines: Machine[];
  laborHourRate: number;
  energyCostKwh: number;
}) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("Todas");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");

  const categories = useMemo(
    () => ["Todas", ...Array.from(new Set(products.map((p) => p.category || "Bonecos")))],
    [products]
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return products.filter((p) => {
      if (status === "active" && !p.active) return false;
      if (status === "inactive" && p.active) return false;
      if (category !== "Todas" && (p.category || "Bonecos") !== category) return false;
      if (!term) return true;
      return (
        p.name.toLowerCase().includes(term) || (p.sku ?? "").toLowerCase().includes(term)
      );
    });
  }, [products, q, category, status]);

  return (
    <div className="table-wrap">
      <div className="section-title list-filters">
        <div>
          <h2>Catálogo</h2>
          <p className="muted">
            {filtered.length} de {products.length} produto{products.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="filters-row">
          <input
            className="input"
            placeholder="Buscar por nome ou SKU"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            className="select"
            value={status}
            onChange={(e) => setStatus(e.target.value as "all" | "active" | "inactive")}
          >
            <option value="all">Todos os status</option>
            <option value="active">Disponíveis</option>
            <option value="inactive">Inativos</option>
          </select>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Produto</th>
            <th>Categoria</th>
            <th>Status</th>
            <th>Preço</th>
            <th>Custo</th>
            <th>Lucro</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((p) => {
            const imgs = [...(p.product_images ?? [])].sort(
              (a, b) => a.sort_order - b.sort_order
            );
            const main = imgs[0]?.public_url;
            return (
              <tr key={p.id}>
                <td>
                  <div className="product-name-cell">
                    {main ? (
                      <img className="product-thumb" src={main} alt="" />
                    ) : (
                      <div className="product-thumb product-thumb-empty">📦</div>
                    )}
                    <div>
                      <strong>{p.name}</strong>
                      {p.sku && <div className="muted">SKU: {p.sku}</div>}
                      <div className="muted">{imgs.length}/8 fotos</div>
                    </div>
                  </div>
                </td>
                <td>{p.category || "Bonecos"}</td>
                <td>
                  <span className={`badge ${p.active ? "green" : "yellow"}`}>
                    {p.active ? "Disponível" : "Inativo"}
                  </span>
                </td>
                <td>{money(Number(p.sale_price))}</td>
                <td>{money(Number(p.estimated_cost))}</td>
                <td>{money(Number(p.sale_price) - Number(p.estimated_cost))}</td>
                <td>
                  <div className="actions">
                    <ProductEditor
                      product={{ ...p, category: p.category || "Bonecos", images: imgs }}
                      materials={materials}
                      machines={machines}
                      laborHourRate={laborHourRate}
                      energyCostKwh={energyCostKwh}
                    />
                    <ProductActions id={p.id} active={p.active} />
                  </div>
                </td>
              </tr>
            );
          })}
          {!filtered.length && (
            <tr>
              <td colSpan={7} className="muted">
                {products.length
                  ? "Nenhum produto encontrado com esses filtros."
                  : "Nenhum produto cadastrado."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
