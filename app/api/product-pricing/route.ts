import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { assertProductOwned } from "@/lib/ownership";
import { savePricing } from "@/lib/product-pricing";
export async function GET(req: Request) {
  try {
    const { supabase, organizationId } = await requireUser();
    const productId = new URL(req.url).searchParams.get("product_id");
    if (!productId) return NextResponse.json({ error: "product_id obrigatório." }, { status: 400 });
    await assertProductOwned(supabase, organizationId, productId);
    const { data, error } = await supabase
      .from("product_pricing")
      .select("*")
      .eq("product_id", productId)
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json(data ?? null);
  } catch (e) {
    return NextResponse.json(
      { error: errorMessage(e, "Erro ao carregar precificação.") },
      { status: 500 }
    );
  }
}
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const { supabase, organizationId } = await requireUser();
    const { product_id, ...values } = b;
    await assertProductOwned(supabase, organizationId, product_id);
    await savePricing(supabase, organizationId, product_id, values);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: errorMessage(e, "Erro ao salvar precificação.") },
      { status: 500 }
    );
  }
}
