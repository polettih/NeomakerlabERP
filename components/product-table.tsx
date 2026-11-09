"use client";
/* eslint-disable @next/next/no-img-element -- miniaturas vêm de URLs externas (Shopee/Storage); next/image exigiria liberar cada domínio */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ProductActions } from "@/components/product-actions";
import { ProductEditor, type Material, type Machine } from "@/components/product-editor";
import { money } from "@/lib/format";
import { errorMessage } from "@/lib/errors";
import { variantCost } from "@/lib/variants";
import { Pagination, usePagination } from "@/components/pagination";

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
  product_variants?:
    | {
        id: string;
        name: string;
        sale_price: number;
        units?: number;
        cost_override?: number | null;
        active: boolean;
      }[]
    | null;
};

export function ProductTable({
  products,
  materials,
  machines,
  laborHourRate,
  energyCostKwh,
  organizationId,
}: {
  products: Product[];
  materials: Material[];
  machines: Machine[];
  laborHourRate: number;
  energyCostKwh: number;
  organizationId: string;
}) {
  const r = useRouter();
  const [recalcMsg, setRecalcMsg] = useState("");
  const [recalcBusy, setRecalcBusy] = useState(false);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("Todas");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");

  async function recalc() {
    if (
      !confirm(
        "Recalcular o custo de todos os produtos com os preços atuais dos materiais? O preço de venda não é alterado."
      )
    )
      return;
    setRecalcBusy(true);
    setRecalcMsg("");
    try {
      const res = await fetch("/api/products/recalculate-costs", { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setRecalcMsg(
        j.updated
          ? `✅ Custo atualizado em ${j.updated} produto(s).`
          : "Os custos já estavam atualizados."
      );
      r.refresh();
    } catch (e) {
      setRecalcMsg(errorMessage(e, "Erro ao recalcular."));
    } finally {
      setRecalcBusy(false);
    }
  }

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
      return p.name.toLowerCase().includes(term) || (p.sku ?? "").toLowerCase().includes(term);
    });
  }, [products, q, category, status]);
  const paged = usePagination(filtered, 25);

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
          <button
            type="button"
            className="btn btn-secondary"
            onClick={recalc}
            disabled={recalcBusy}
            title="Atualiza o custo dos produtos com o preço médio atual dos materiais"
          >
            {recalcBusy ? "Recalculando..." : "↻ Recalcular custos"}
          </button>
        </div>
      </div>
      {recalcMsg && <p className="muted">{recalcMsg}</p>}
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
          {paged.pageItems.map((p) => {
            const imgs = [...(p.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
            const main = imgs[0]?.public_url;
            const vars = (p.product_variants ?? []).filter((v) => v.active);
            const prices = vars.map((v) => Number(v.sale_price));
            const priceLabel = vars.length
              ? Math.min(...prices) === Math.max(...prices)
                ? money(prices[0])
                : `${money(Math.min(...prices))} – ${money(Math.max(...prices))}`
              : money(Number(p.sale_price));
            return (
              <tr key={p.id}>
                <td>
                  <div className="product-name-cell">
                    {main ? (
                      <img className="product-thumb" src={main} alt="" loading="lazy" />
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
                <td>
                  {priceLabel}
                  {vars.length > 0 && (
                    <details>
                      <summary className="muted">
                        {vars.length} variaç{vars.length === 1 ? "ão" : "ões"}
                      </summary>
                      <table>
                        <thead>
                          <tr>
                            <th>Variação</th>
                            <th>Preço</th>
                            <th>Custo</th>
                            <th>Margem</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vars.map((v) => {
                            const cost = variantCost(
                              { units: v.units ?? 1, cost_override: v.cost_override ?? null },
                              Number(p.estimated_cost)
                            );
                            const price = Number(v.sale_price);
                            const margin = price > 0 ? ((price - cost) / price) * 100 : 0;
                            return (
                              <tr key={v.id}>
                                <td>{v.name}</td>
                                <td>{money(price)}</td>
                                <td>{money(cost)}</td>
                                <td style={{ color: margin < 0 ? "#ef4444" : undefined }}>
                                  {money(price - cost)} ({margin.toFixed(0)}%)
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </details>
                  )}
                </td>
                <td>{money(Number(p.estimated_cost))}</td>
                <td>
                  {vars.length ? "—" : money(Number(p.sale_price) - Number(p.estimated_cost))}
                </td>
                <td>
                  <div className="actions">
                    <ProductEditor
                      product={{ ...p, category: p.category || "Bonecos", images: imgs }}
                      materials={materials}
                      machines={machines}
                      laborHourRate={laborHourRate}
                      energyCostKwh={energyCostKwh}
                      organizationId={organizationId}
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
      <Pagination
        page={paged.page}
        pages={paged.pages}
        total={paged.total}
        pageSize={paged.pageSize}
        onPage={paged.setPage}
      />
    </div>
  );
}
