import { money } from "@/lib/format";
import type { ShoppingRow } from "@/lib/shopping-list";

const qty = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/** Lista de compras sugerida a partir dos pedidos em aberto e do estoque mínimo. */
export function ShoppingList({ rows }: { rows: ShoppingRow[] }) {
  const total = rows.reduce((s, r) => s + r.estimated_cost, 0);
  if (!rows.length)
    return (
      <div className="card">
        <p>
          ✅ Nada para comprar: o estoque cobre os pedidos em aberto e o mínimo de cada material.
        </p>
      </div>
    );
  return (
    <div className="card">
      <div className="section-title">
        <div>
          <h2>Lista de compras sugerida</h2>
          <p className="muted">
            Considera o consumo dos pedidos ainda não iniciados (novos e em preparação) mais o
            estoque mínimo de cada material. Estimativa pelo custo médio.
          </p>
        </div>
        <strong>{money(total)}</strong>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Material</th>
              <th>Em estoque</th>
              <th>Pedidos precisam</th>
              <th>Mínimo</th>
              <th>Comprar</th>
              <th>Custo estimado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.material_id}>
                <td>
                  {r.name}
                  {r.color_name ? ` — ${r.color_name}` : ""}
                </td>
                <td>
                  {qty(r.on_hand)} {r.unit}
                </td>
                <td>
                  {qty(r.needed)} {r.unit}
                </td>
                <td>
                  {qty(r.minimum)} {r.unit}
                </td>
                <td>
                  <strong>
                    {qty(r.to_buy)} {r.unit}
                  </strong>
                </td>
                <td>{money(r.estimated_cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
