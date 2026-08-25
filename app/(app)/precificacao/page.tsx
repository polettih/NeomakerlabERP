import { requireUser } from '@/lib/auth';
import { PricingManager } from '@/components/pricing-manager';

export default async function PrecificacaoPage() {
  const { supabase, organizationId } = await requireUser();

  const [{ data: products }, { data: materials }, { data: pricing }, { data: links }, { data: settings }] =
    await Promise.all([
      supabase
        .from('products')
        .select('id,name,sale_price,estimated_cost,category')
        .eq('active', true)
        .order('name'),
      supabase
        .from('materials')
        .select('id,name,category,unit,average_cost')
        .eq('active', true)
        .order('name'),
      supabase.from('product_pricing').select('*'),
      supabase
        .from('product_materials')
        .select('id,product_id,material_id,quantity,notes,material:materials(id,name,category,unit,average_cost)'),
      supabase
        .from('organization_settings')
        .select('labor_hour_rate')
        .eq('organization_id', organizationId)
        .maybeSingle(),
    ]);

  return (
    <div className="content">
      <div className="section-title">
        <div>
          <h1>🧮 Precificação</h1>
          <p className="muted">
            Calcule energia, materiais, mão de obra, depreciação, preço e lucro em uma área separada.
          </p>
        </div>
      </div>
      <PricingManager
        products={products ?? []}
        materials={materials ?? []}
        initialPricing={pricing ?? []}
        initialLinks={links ?? []}
        laborHourRate={Number(settings?.labor_hour_rate ?? 30)}
      />
    </div>
  );
}
