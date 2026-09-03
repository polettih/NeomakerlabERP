import { requireUser } from "@/lib/auth";
import { CreateProductForm } from "@/components/create-product-form";
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
  product_images: { id: string; public_url: string; storage_path: string; sort_order: number }[] | null;
};

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
      </div>
      <CreateProductForm
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
