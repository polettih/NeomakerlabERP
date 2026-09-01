import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
export async function DELETE(req: Request) {
  try {
    const { supabase } = await requireUser();
    const b = await req.json();
    if (!b.product_id)
      return NextResponse.json({ error: "product_id obrigatório." }, { status: 400 });
    const { error } = await supabase
      .from("product_materials")
      .delete()
      .eq("product_id", b.product_id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e, "Erro.") }, { status: 500 });
  }
}
