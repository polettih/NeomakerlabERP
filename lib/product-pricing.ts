import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Grava a precificação do produto e o custo estimado em products. Usado pela rota de
 * precificação e pelo salvamento completo do produto, para a regra ficar num lugar só.
 */
export async function savePricing(
  supabase: SupabaseClient,
  organizationId: string,
  productId: string,
  input: Record<string, unknown>
) {
  const { data: settings } = await supabase
    .from("organization_settings")
    .select("labor_hour_rate")
    .eq("organization_id", organizationId)
    .maybeSingle();
  const values = {
    ...input,
    labor_hour: Number(settings?.labor_hour_rate ?? 30),
    marketplace_commission: 0,
  };
  const { error } = await supabase
    .from("product_pricing")
    .upsert({ ...values, product_id: productId }, { onConflict: "product_id" });
  if (error) throw error;
  const { error: pe } = await supabase
    .from("products")
    .update({ estimated_cost: Number(input.total_cost || 0) })
    .eq("id", productId)
    .eq("organization_id", organizationId);
  if (pe) throw pe;
}
