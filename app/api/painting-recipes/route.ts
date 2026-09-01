import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
export async function POST(request: Request) {
  try {
    const { supabase, organizationId } = await requireUser();
    const body = await request.json();
    if (!body.name?.trim())
      return NextResponse.json({ error: "Nome da receita é obrigatório." }, { status: 400 });
    const { data, error } = await supabase
      .from("painting_recipes")
      .insert({
        organization_id: organizationId,
        name: body.name.trim(),
        category: body.category || "Geral",
        description: body.description || null,
        colors: Array.isArray(body.colors) ? body.colors : [],
        dilution: body.dilution || null,
        finish: body.finish || null,
        notes: body.notes || null,
        product_id: body.product_id || null,
        steps: Array.isArray(body.steps) ? body.steps : [],
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e, "Erro interno") }, { status: 500 });
  }
}
export async function DELETE(request: Request) {
  try {
    const { supabase, organizationId } = await requireUser();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
    const { error } = await supabase
      .from("painting_recipes")
      .delete()
      .eq("id", id)
      .eq("organization_id", organizationId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e, "Erro interno") }, { status: 500 });
  }
}
