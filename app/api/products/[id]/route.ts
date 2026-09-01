import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { supabase, organizationId } = await requireUser();
    const update: Record<string, unknown> = {};
    if (typeof body.active === "boolean") update.active = body.active;
    if (typeof body.name === "string") update.name = body.name.trim();
    if (body.sale_price !== undefined) update.sale_price = Number(body.sale_price || 0);
    if (body.estimated_cost !== undefined) update.estimated_cost = Number(body.estimated_cost || 0);
    if (typeof body.category === "string") update.category = body.category;
    const { data, error } = await supabase
      .from("products")
      .update(update)
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e, "Erro ao atualizar produto.") }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, organizationId } = await requireUser();
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", id)
      .eq("organization_id", organizationId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e, "Erro ao excluir produto.") }, { status: 500 });
  }
}
