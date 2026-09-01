import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
export async function POST(req: Request) {
  try {
    const b = await req.json();
    if (
      !b.material_id ||
      typeof b.material_id !== "string" ||
      b.material_id.length !== 36 ||
      !b.quantity
    )
      return NextResponse.json(
        { error: "Material e quantidade são obrigatórios." },
        { status: 400 }
      );
    const qty = Number(b.quantity);
    if (!Number.isFinite(qty) || qty === 0)
      return NextResponse.json(
        { error: "A quantidade deve ser diferente de zero." },
        { status: 400 }
      );
    const { supabase } = await requireUser();
    const { data: mat, error: me } = await supabase
      .from("materials")
      .select("id,organization_id,quantity_on_hand,average_cost,name")
      .eq("id", b.material_id)
      .single();
    if (me) throw me;
    if (qty < 0 && Number(mat.quantity_on_hand) < Math.abs(qty))
      return NextResponse.json({ error: `Estoque insuficiente de ${mat.name}.` }, { status: 400 });
    const { error } = await supabase.from("stock_movements").insert({
      organization_id: mat.organization_id,
      material_id: mat.id,
      movement_type: b.movement_type || "manual_consumption",
      quantity: qty,
      unit_cost: Number(b.unit_cost ?? mat.average_cost),
      product_id: b.product_id || null,
      order_id: b.order_id || null,
      description: b.description || "Lançamento manual",
    });
    if (error) throw error;
    const { error: ue } = await supabase
      .from("materials")
      .update({ quantity_on_hand: Number(mat.quantity_on_hand) + qty })
      .eq("id", mat.id);
    if (ue) throw ue;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e, "Erro.") }, { status: 500 });
  }
}
