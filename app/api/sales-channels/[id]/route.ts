import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { supabase, organizationId } = await requireUser();
    const update: Record<string, unknown> = {};
    if (body.name !== undefined) update.name = String(body.name).trim();
    if (typeof body.active === "boolean") update.active = body.active;
    if (body.fee_percent !== undefined)
      update.fee_percent = Math.max(0, Math.min(1, Number(body.fee_percent)));
    if (body.fixed_fee !== undefined) update.fixed_fee = Math.max(0, Number(body.fixed_fee));
    const { data, error } = await supabase
      .from("sales_channels")
      .update(update)
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select()
      .single();
    if (error) {
      if (error.code === "23505")
        throw new Error("Já existe um canal com esse nome nesta organização.");
      if (error.code === "PGRST116") throw new Error("Canal não encontrado.");
      throw error;
    }
    return NextResponse.json(data);
  } catch (e: unknown) {
    return NextResponse.json({ error: errorMessage(e, "Erro ao atualizar canal.") }, { status: 500 });
  }
}
export async function DELETE(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, organizationId } = await requireUser();
    const { error } = await supabase
      .from("sales_channels")
      .delete()
      .eq("id", id)
      .eq("organization_id", organizationId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: errorMessage(e, "Não foi possível excluir o canal.") },
      { status: 500 }
    );
  }
}
