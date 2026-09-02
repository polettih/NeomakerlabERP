import { requireUser } from "@/lib/auth";
import { CreateOrderForm } from "@/components/create-order-form";
export default async function NovoPedidoPage() {
  const { supabase } = await requireUser();
  const [{ data: customers }, { data: products }, { data: channels }, { data: tiers }] =
    await Promise.all([
      supabase.from("customers").select("id,name").order("name"),
      supabase
        .from("products")
        .select(
          "id,name,sale_price,estimated_cost,category,product_images(id,public_url,sort_order)"
        )
        .eq("active", true)
        .order("name"),
      supabase
        .from("sales_channels")
        .select("id,name,fee_percent,fixed_fee")
        .eq("active", true)
        .order("name"),
      supabase
        .from("sales_channel_tiers")
        .select("channel_id,min_value,max_value,fee_percent,fixed_fee")
        .order("sort_order"),
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
        tiers={tiers ?? []}
      />
    </div>
  );
}
