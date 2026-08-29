import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
export async function GET(req: Request) {
  try {
    const { supabase } = await requireUser();
    const productId = new URL(req.url).searchParams.get("product_id");
    if (!productId) return NextResponse.json({ error: "product_id obrigatório." }, { status: 400 });
    const { data, error } = await supabase
      .from("product_pricing")
      .select("*")
      .eq("product_id", productId)
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json(data ?? null);
  } catch (e: unknown) {
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
    const { data: settings } = await supabase
      .from("organization_settings")
      .select("labor_hour_rate")
      .eq("organization_id", organizationId)
      .maybeSingle();
    values.labor_hour = Number(settings?.labor_hour_rate ?? 30);
    values.marketplace_commission = 0;
    const { error } = await supabase
      .from("product_pricing")
      .upsert({ product_id, ...values }, { onConflict: "product_id" });
    if (error) throw error;
    const { error: pe } = await supabase
      .from("products")
      .update({
        sale_price: Number(b.suggested_price || 0),
        estimated_cost: Number(b.total_cost || 0),
      })
      .eq("id", product_id);
    if (pe) throw pe;
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: errorMessage(e, "Erro ao salvar precificação.") },
      { status: 500 }
    );
  }
}
