import { requireUser } from "@/lib/auth";
import { CreateProductForm } from "@/components/create-product-form";
import { ProductActions } from "@/components/product-actions";
import { ProductEditor } from "@/components/product-editor";
const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export default async function ProdutosPage() {
  const { supabase, organizationId } = await requireUser();
  const [{ data }, { data: materials }, { data: machines }, { data: settings }] = await Promise.all(
    [
      supabase
        .from("products")
        .select(
          "id,name,sku,sale_price,estimated_cost,active,category,created_at,product_images(id,public_url,storage_path,sort_order)"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("materials")
        .select("id,name,category,unit,average_cost")
        .eq("active", true)
        .eq("organization_id", organizationId)
        .order("name"),
      supabase
        .from("machines")
        .select(
          "id,name,category,power_kw,purchase_value,useful_hours,depreciation_per_hour,active"
        )
        .eq("organization_id", organizationId)
        .order("category")
        .order("name"),
      supabase
        .from("organization_settings")
        .select("labor_hour_rate,energy_cost_kwh")
        .eq("organization_id", organizationId)
        .maybeSingle(),
    ]
  );
  return (
    <div className="content">
      <div className="section-title">
        <div>
          <h1>Produtos</h1>
          <p className="muted">Catálogo, disponibilidade, categorias e fotos</p>
        </div>
      </div>
      <CreateProductForm
        materials={materials ?? []}
        machines={machines ?? []}
        laborHourRate={Number(settings?.labor_hour_rate ?? 30)}
        energyCostKwh={Number(settings?.energy_cost_kwh ?? 1.12)}
      />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Categoria</th>
              <th>Status</th>
              <th>Preço</th>
              <th>Custo</th>
              <th>Margem</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((p: any) => {
              const imgs = [...(p.product_images ?? [])].sort(
                (a: any, b: any) => a.sort_order - b.sort_order
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
                        product={{ ...p, images: imgs }}
                        materials={materials ?? []}
                        machines={machines ?? []}
                        laborHourRate={Number(settings?.labor_hour_rate ?? 30)}
                        energyCostKwh={Number(settings?.energy_cost_kwh ?? 1.12)}
                      />
                      <ProductActions id={p.id} active={p.active} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {!data?.length && (
              <tr>
                <td colSpan={7} className="muted">
                  Nenhum produto cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
