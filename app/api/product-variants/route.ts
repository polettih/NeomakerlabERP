import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { assertProductOwned } from "@/lib/ownership";
import { syncVariants } from "@/lib/variants-sync";

export async function GET(req: Request) {
  try {
    const { supabase, organizationId } = await requireUser();
    const productId = new URL(req.url).searchParams.get("product_id");
    if (!productId) return NextResponse.json({ error: "product_id obrigatório." }, { status: 400 });
    const { data, error } = await supabase
      .from("product_variants")
      .select("id,product_id,name,sku,sale_price,units,cost_override,active,sort_order")
      .eq("organization_id", organizationId)
      .eq("product_id", productId)
      .order("sort_order")
      .order("name");
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (e) {
    return NextResponse.json(
      { error: errorMessage(e, "Erro ao carregar variações.") },
      { status: 500 }
    );
  }
}

/** Sincroniza a lista completa de variações de um produto (ver lib/variants-sync.ts). */
export async function PUT(req: Request) {
  try {
    const { supabase, organizationId } = await requireUser();
    const body = await req.json();
    const productId = String(body.product_id || "");
    await assertProductOwned(supabase, organizationId, productId);
    const count = await syncVariants(supabase, organizationId, productId, body.variants ?? []);
    return NextResponse.json({ ok: true, count });
  } catch (e) {
    return NextResponse.json(
      { error: errorMessage(e, "Erro ao salvar variações.") },
      { status: 500 }
    );
  }
}
