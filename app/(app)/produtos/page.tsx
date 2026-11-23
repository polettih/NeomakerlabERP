import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { ProductForm } from "@/components/product-form";
import { ProductTable } from "@/components/product-table";

type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  sale_price: number;
  estimated_cost: number;
  active: boolean;
  category: string | null;
  created_at: string;
  product_variants:
    | {
        id: string;
        name: string;
        sale_price: number;
        units: number;
        cost_override: number | null;
        active: boolean;
        sort_order: number;
      }[]
    | null;
  product_images:
    { id: string; public_url: string; storage_path: string; sort_order: number }[] | null;
};

export default async function ProdutosPage() {
  const { supabase, organizationId } = await requireUser();
  const [{ data }, { data: materials }, { data: machines }, { data: settings }] = await Promise.all(
    [
      supabase
        .from("products")
        .select(
          "id,name,sku,external_ids,sale_price,estimated_cost,active,category,created_at,product_images(id,public_url,storage_path,sort_order),product_variants(id,name,sale_price,units,cost_override,active,sort_order)"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("materials")
        .select("id,name,category,material_type,color_name,unit,average_cost")
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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="btn btn-secondary" href="/produtos/importar">
            Importar produtos da Shopee
          </Link>
          <Link className="btn btn-secondary" href="/produtos/importar-catalogo">
            Atualizar SKU, fotos, preços e variações
          </Link>
        </div>
      </div>
      <ProductForm
        existingProducts={(data ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          external_ids:
            (p as { external_ids?: Record<string, string> | null }).external_ids ?? null,
        }))}
        materials={materials ?? []}
        machines={machines ?? []}
        laborHourRate={Number(settings?.labor_hour_rate ?? 30)}
        energyCostKwh={Number(settings?.energy_cost_kwh ?? 1.12)}
        organizationId={organizationId}
      />
      <ProductTable
        products={(data ?? []) as ProductRow[]}
        materials={materials ?? []}
        machines={machines ?? []}
        laborHourRate={Number(settings?.labor_hour_rate ?? 30)}
        energyCostKwh={Number(settings?.energy_cost_kwh ?? 1.12)}
        organizationId={organizationId}
      />
    </div>
  );
}
