import { requireUser } from "@/lib/auth";
import { SalesImport } from "@/components/sales-import";

export default async function ImportarPedidosPage() {
  const { supabase, organizationId } = await requireUser();
  const [{ data: products }, { data: channels }] = await Promise.all([
    supabase
      .from("products")
      .select("id,name,sku")
      .eq("organization_id", organizationId)
      .eq("active", true)
      .order("name"),
    supabase
      .from("sales_channels")
      .select("id,name,active")
      .eq("organization_id", organizationId)
      .order("name"),
  ]);

  return (
    <div className="content">
      <div className="section-title">
        <div>
          <h1>Importar vendas</h1>
          <p className="muted">
            Por enquanto só Shopee — Mercado Livre e TikTok Shop vêm em seguida.
          </p>
        </div>
      </div>
      <SalesImport products={products ?? []} channels={channels ?? []} />
    </div>
  );
}
