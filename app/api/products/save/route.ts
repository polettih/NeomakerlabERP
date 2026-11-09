import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { assertMaterialsOwned, assertProductOwned } from "@/lib/ownership";
import { savePricing } from "@/lib/product-pricing";
import { normalizeVariants, syncVariants, type VariantInput } from "@/lib/variants-sync";

type MaterialInput = { material_id: string; quantity: number; usage_type?: string };
type Row = Record<string, unknown>;

/**
 * Salva o produto inteiro numa única chamada: dados, materiais, precificação e variações.
 * Sem product_id cria o produto; com product_id atualiza. Se qualquer etapa falhar, o que
 * já foi gravado é desfeito (produto novo é apagado; produto existente volta ao estado
 * anterior), para nunca ficar um produto pela metade — por exemplo, sem os materiais.
 */
export async function POST(req: Request) {
  const { supabase, organizationId } = await requireUser();
  let createdId: string | null = null;
  let snapshot: {
    productId: string;
    product: Row;
    materials: Row[];
    pricing: Row | null;
    variants: Row[];
  } | null = null;
  try {
    const b = await req.json();
    const name = String(b.product?.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });
    const salePrice = Number(b.product?.sale_price);
    if (!Number.isFinite(salePrice) || salePrice <= 0)
      return NextResponse.json({ error: "Informe um preço de venda válido." }, { status: 400 });
    const materials = ((b.materials ?? []) as MaterialInput[]).filter(
      (m) => m?.material_id && Number(m.quantity) > 0
    );
    const variants = b.variants as VariantInput[] | undefined;
    // Valida tudo antes de gravar qualquer coisa.
    if (variants) normalizeVariants(variants, organizationId, "validate");
    await assertMaterialsOwned(
      supabase,
      organizationId,
      materials.map((m) => m.material_id)
    );

    const productFields = {
      name,
      category: b.product?.category || "Bonecos",
      sale_price: salePrice,
      estimated_cost: Number(b.product?.estimated_cost || 0),
      ...(b.product?.sku !== undefined ? { sku: b.product.sku || null } : {}),
      ...(b.product?.description !== undefined
        ? { description: b.product.description || null }
        : {}),
    };
    let productId: string = b.product_id || "";
    if (productId) {
      await assertProductOwned(supabase, organizationId, productId);
      const [{ data: prod }, { data: mats }, { data: pr }, { data: vars }] = await Promise.all([
        supabase.from("products").select("*").eq("id", productId).single(),
        supabase.from("product_materials").select("*").eq("product_id", productId),
        supabase.from("product_pricing").select("*").eq("product_id", productId).maybeSingle(),
        supabase.from("product_variants").select("*").eq("product_id", productId),
      ]);
      snapshot = {
        productId,
        product: (prod ?? {}) as Row,
        materials: (mats ?? []) as Row[],
        pricing: (pr ?? null) as Row | null,
        variants: (vars ?? []) as Row[],
      };
      const { error } = await supabase
        .from("products")
        .update(productFields)
        .eq("id", productId)
        .eq("organization_id", organizationId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase
        .from("products")
        .insert({ ...productFields, organization_id: organizationId })
        .select("id")
        .single();
      if (error) throw error;
      productId = data.id;
      createdId = productId;
    }

    const { error: de } = await supabase
      .from("product_materials")
      .delete()
      .eq("product_id", productId);
    if (de) throw de;
    // Um material só pode aparecer uma vez por produto (unique product_id+material_id).
    const merged = new Map<string, MaterialInput>();
    for (const m of materials) {
      const prev = merged.get(m.material_id);
      merged.set(
        m.material_id,
        prev ? { ...prev, quantity: Number(prev.quantity) + Number(m.quantity) } : m
      );
    }
    if (merged.size) {
      const { error } = await supabase.from("product_materials").insert(
        [...merged.values()].map((m) => ({
          product_id: productId,
          material_id: m.material_id,
          quantity: Number(m.quantity),
          usage_type: ["fdm", "resin", "other"].includes(String(m.usage_type))
            ? m.usage_type
            : "other",
        }))
      );
      if (error) throw error;
    }
    if (b.pricing) await savePricing(supabase, organizationId, productId, b.pricing);
    if (variants) await syncVariants(supabase, organizationId, productId, variants);
    return NextResponse.json({ id: productId });
  } catch (e) {
    // Desfaz o que já tinha sido gravado.
    try {
      if (createdId) {
        await supabase
          .from("products")
          .delete()
          .eq("id", createdId)
          .eq("organization_id", organizationId);
      } else if (snapshot) {
        const s = snapshot;
        if (s.product.id) {
          const rest = { ...s.product };
          delete rest.id;
          delete rest.organization_id;
          delete rest.created_at;
          await supabase.from("products").update(rest).eq("id", s.productId);
        }
        await supabase.from("product_materials").delete().eq("product_id", s.productId);
        if (s.materials.length) await supabase.from("product_materials").insert(s.materials);
        if (s.pricing)
          await supabase.from("product_pricing").upsert(s.pricing, { onConflict: "product_id" });
        await supabase.from("product_variants").delete().eq("product_id", s.productId);
        if (s.variants.length) await supabase.from("product_variants").insert(s.variants);
      }
    } catch {
      // melhor esforço: o erro original é o que importa para o usuário
    }
    return NextResponse.json(
      { error: errorMessage(e, "Erro ao salvar produto.") },
      { status: 500 }
    );
  }
}
