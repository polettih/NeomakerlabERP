import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
export async function POST(req: Request) {
  try {
    const b = await req.json();
    if (!b.material_id || typeof b.material_id !== "string" || b.material_id.length !== 36)
      return NextResponse.json({ error: "Selecione um material válido." }, { status: 400 });
    const quantity = Number(b.quantity),
      total = Number(b.total_cost);
    if (!Number.isFinite(quantity) || quantity <= 0)
      return NextResponse.json({ error: "A quantidade deve ser maior que zero." }, { status: 400 });
    if (!Number.isFinite(total) || total < 0)
      return NextResponse.json({ error: "Informe um valor de compra válido." }, { status: 400 });
    const { supabase } = await requireUser();
    const { error } = await supabase.rpc("register_material_purchase", {
      p_material: b.material_id,
      p_quantity: quantity,
      p_total: total,
      p_supplier: b.supplier || "",
      p_notes: b.notes || "",
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro ao registrar compra." }, { status: 500 });
  }
}
