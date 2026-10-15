"use client";
import { money } from "@/lib/format";
import { guessUnits, newVariantDraft, variantCost, type VariantDraft } from "@/lib/variants";

/**
 * Editor de variações (estilo Shopee): cada linha é uma variação vendável com nome, SKU,
 * preço, unidades (quantas peças base consome) e custo opcional. Componente controlado —
 * quem usa guarda a lista e grava junto com o produto via /api/product-variants.
 */
export function VariantsEditor({
  variants,
  onChange,
  productCost,
  basePrice,
}: {
  variants: VariantDraft[];
  onChange: (v: VariantDraft[]) => void;
  /** Custo calculado do produto (1 unidade), usado como base quando a variação não tem custo próprio. */
  productCost: number;
  /** Preço de venda do produto, sugerido ao adicionar uma variação. */
  basePrice: number;
}) {
  const update = (key: string, patch: Partial<VariantDraft>) =>
    onChange(variants.map((v) => (v.key === key ? { ...v, ...patch } : v)));
  const remove = (key: string) => onChange(variants.filter((v) => v.key !== key));
  const add = () =>
    onChange([
      ...variants,
      newVariantDraft({ sale_price: basePrice > 0 ? basePrice.toFixed(2) : "" }),
    ]);

  return (
    <div className="grid" style={{ gap: 10 }}>
      <p className="muted">
        Use quando o mesmo produto é vendido em opções diferentes (cor, kit de 1/2/3 unidades...).
        Cada variação tem seu preço e SKU. &quot;Unidades&quot; indica quantas peças base ela
        consome (kit com 2 = 2), o que multiplica custo e baixa de estoque. Sem variações, o produto
        é vendido pelo preço único.
      </p>
      {variants.map((v) => {
        const cost = variantCost(
          { units: v.units, cost_override: v.cost_override === "" ? null : v.cost_override },
          productCost
        );
        const price = Number(v.sale_price) || 0;
        const profit = price - cost;
        return (
          <div key={v.key} className="card" style={{ background: "#0f1318" }}>
            <div className="form-grid">
              <div className="field">
                <label>Nome da variação</label>
                <input
                  className="input"
                  placeholder="Ex.: Roxo, 2 Unidades"
                  value={v.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    // Sugere unidades a partir do nome enquanto o usuário não mexeu nelas.
                    const patch: Partial<VariantDraft> = { name };
                    if (v.units === "1" || v.units === String(guessUnits(v.name)))
                      patch.units = String(guessUnits(name));
                    update(v.key, patch);
                  }}
                />
              </div>
              <div className="field">
                <label>SKU</label>
                <input
                  className="input"
                  value={v.sku}
                  onChange={(e) => update(v.key, { sku: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Preço de venda (R$)</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={v.sale_price}
                  onChange={(e) => update(v.key, { sale_price: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Unidades</label>
                <input
                  className="input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={v.units}
                  onChange={(e) => update(v.key, { units: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Custo próprio (opcional)</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={`Auto: ${money(productCost * (Number(v.units) || 1))}`}
                  value={v.cost_override}
                  onChange={(e) => update(v.key, { cost_override: e.target.value })}
                />
              </div>
            </div>
            <div className="filters-row" style={{ marginTop: 8, justifyContent: "space-between" }}>
              <span className="muted">
                Custo {money(cost)} · Lucro{" "}
                <strong style={{ color: profit >= 0 ? undefined : "#ef4444" }}>
                  {money(profit)}
                </strong>
              </span>
              <span className="actions">
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={v.active}
                    onChange={(e) => update(v.key, { active: e.target.checked })}
                  />
                  Ativa
                </label>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => remove(v.key)}
                >
                  Remover
                </button>
              </span>
            </div>
          </div>
        );
      })}
      <div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={add}>
          + Adicionar variação
        </button>
      </div>
    </div>
  );
}

/** Valida as variações antes de enviar; devolve a mensagem de erro ou null. */
export function validateVariants(variants: VariantDraft[]): string | null {
  const seen = new Set<string>();
  for (const v of variants) {
    const name = v.name.trim();
    if (!name) return "Toda variação precisa de um nome.";
    if (seen.has(name.toLowerCase())) return `Variação repetida: "${name}".`;
    seen.add(name.toLowerCase());
    if (!(Number(v.sale_price) >= 0) || v.sale_price === "")
      return `Informe o preço da variação "${name}".`;
    if (!(Number(v.units) > 0)) return `Unidades inválidas na variação "${name}".`;
  }
  return null;
}

export const variantsPayload = (variants: VariantDraft[]) =>
  variants.map((v) => ({
    id: v.id,
    name: v.name.trim(),
    sku: v.sku.trim() || null,
    sale_price: Number(v.sale_price),
    units: Number(v.units),
    cost_override: v.cost_override === "" ? null : Number(v.cost_override),
    active: v.active,
  }));
