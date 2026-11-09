import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { assertMaterialsOwned, assertProductOwned } from "@/lib/ownership";

export async function GET(req: Request) {
  try {
    const { supabase, organizationId } = await requireUser();
    const productId = new URL(req.url).searchParams.get("product_id");
    if (!productId) return NextResponse.json({ error: "product_id obrigatório." }, { status: 400 });
    await assertProductOwned(supabase, organizationId, productId);
    const { data, error } = await supabase
      .from("product_materials")
      .select("id,product_id,material_id,quantity,usage_type,notes")
      .eq("product_id", productId);
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e, "Erro.") }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const b = await req.json();
    const { supabase, organizationId } = await requireUser();
    await assertProductOwned(supabase, organizationId, b.product_id);
    await assertMaterialsOwned(supabase, organizationId, [b.material_id]);
    const { data, error } = await supabase
      .from("product_materials")
      .upsert(
        {
          product_id: b.product_id,
          material_id: b.material_id,
          quantity: Number(b.quantity),
          usage_type: b.usage_type || "other",
          notes: b.notes || null,
        },
        { onConflict: "product_id,material_id" }
      )
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e, "Erro.") }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const b = await req.json();
    const { supabase, organizationId } = await requireUser();
    const { data: row, error: re } = await supabase
      .from("product_materials")
      .select("id,product_id")
      .eq("id", b.id)
      .maybeSingle();
    if (re) throw re;
    if (!row) return NextResponse.json({ ok: true });
    await assertProductOwned(supabase, organizationId, row.product_id);
    const { error } = await supabase.from("product_materials").delete().eq("id", row.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e, "Erro.") }, { status: 500 });
  }
}
