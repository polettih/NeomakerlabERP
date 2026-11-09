import type { SupabaseClient } from "@supabase/supabase-js";

/** Garante que o produto pertence à organização do usuário (defesa além do RLS). */
export async function assertProductOwned(
  supabase: SupabaseClient,
  organizationId: string,
  productId: string
) {
  if (!productId) throw new Error("product_id obrigatório.");
  const { data, error } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Produto não encontrado.");
}

/** Garante que todos os materiais informados pertencem à organização. */
export async function assertMaterialsOwned(
  supabase: SupabaseClient,
  organizationId: string,
  materialIds: string[]
) {
  const ids = [...new Set(materialIds.filter(Boolean))];
  if (!ids.length) return;
  const { data, error } = await supabase
    .from("materials")
    .select("id")
    .eq("organization_id", organizationId)
    .in("id", ids);
  if (error) throw error;
  if ((data ?? []).length !== ids.length) throw new Error("Material não encontrado.");
}
