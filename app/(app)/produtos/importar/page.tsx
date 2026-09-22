import { requireUser } from "@/lib/auth";
import { ProductImport } from "@/components/product-import";

export default async function ImportarProdutosPage() {
  const { supabase, organizationId } = await requireUser();
  const { data: products } = await supabase
    .from("products")
    .select("id,name,external_ids")
    .eq("organization_id", organizationId);
  return (
    <div className="content">
      <div className="section-title">
        <div>
          <h1>Importar produtos</h1>
          <p className="muted">
            Traga o catálogo exportado da Shopee (dados básicos + mídia) e cadastre tudo de uma
            vez, com fotos.
          </p>
        </div>
      </div>
      <ProductImport existingProducts={products ?? []} />
    </div>
  );
}
