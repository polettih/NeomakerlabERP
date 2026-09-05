import { requireUser } from "@/lib/auth";
import { CreateOrderForm } from "@/components/create-order-form";
export default async function NovoPedidoPage() {
  const { supabase, organizationId } = await requireUser();
  const [{ data: customers }, { data: products }, { data: channels }, { data: materials }] =
    await Promise.all([
      supabase.from("customers").select("id,name").order("name"),
      supabase
        .from("products")
        .select(
          "id,name,sale_price,estimated_cost,category,product_images(id,public_url,sort_order),product_materials(material_id,quantity,usage_type)"
        )
        .eq("active", true)
        .order("name"),
      supabase
        .from("sales_channels")
        .select("id,name,fee_percent,fixed_fee,fee_bands")
        .eq("active", true)
        .order("name"),
      // Carregado à parte (não por produto) porque a troca de filamento/resina em um
      // pedido pode usar qualquer material do mesmo tipo, não só os já vinculados ao
      // produto — é assim que dá pra vender o mesmo produto em outra cor sem cadastrar
      // um produto novo.
      supabase
        .from("materials")
        .select("id,name,material_type,color_name,average_cost,unit")
        .eq("active", true)
        .eq("organization_id", organizationId)
        .order("material_type")
        .order("name"),
    ]);
  return (
    <div className="content">
      <div className="section-title">
        <div>
          <h1>Novo pedido</h1>
          <p className="muted">Cadastre uma venda e envie para produção.</p>
        </div>
      </div>
      <CreateOrderForm
        customers={customers ?? []}
        products={products ?? []}
        channels={channels ?? []}
        materials={materials ?? []}
      />
    </div>
  );
}
