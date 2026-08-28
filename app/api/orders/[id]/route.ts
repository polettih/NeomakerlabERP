import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";

const allowed = [
  "new",
  "preparation",
  "production",
  "finishing",
  "packaging",
  "shipped",
  "delivered",
  "cancelled",
];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { supabase } = await requireUser();
    const { data: old, error: oe } = await supabase
      .from("orders")
      .select("id,status,expected_date,completed_at")
      .eq("id", id)
      .single();
    if (oe) throw oe;
    const update: Record<string, unknown> = {};
    if (body.status !== undefined) {
      if (!allowed.includes(body.status))
        return NextResponse.json({ error: "Status inválido." }, { status: 400 });
      update.status = body.status;
      if (body.status === "shipped")
        update.shipped_at = body.shipped_at || new Date().toISOString();
      if (body.status === "delivered") {
        const done = body.completed_at || new Date().toISOString();
        update.delivered_at = done;
        update.completed_at = done;
      }
    }
    if (body.expected_date !== undefined) update.expected_date = body.expected_date || null;
    if (body.completed_at !== undefined) update.completed_at = body.completed_at || null;
    if (body.status === "delivered" && body.completed_at !== undefined)
      update.delivered_at = body.completed_at || null;
    if (body.notes !== undefined) update.notes = body.notes;
    const { data, error } = await supabase
      .from("orders")
      .update(update)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    if (body.status && body.status !== old.status) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error: he } = await supabase
        .from("order_status_history")
        .insert({
          order_id: id,
          old_status: old.status,
          new_status: body.status,
          changed_by: user?.id || null,
        });
      if (he) throw he;
      if (body.status === "production") {
        const { error: pe } = await supabase
          .from("production_orders")
          .update({ status: "in_progress", started_at: new Date().toISOString() })
          .eq("order_id", id);
        if (pe) throw pe;
      } else if (["shipped", "delivered", "cancelled"].includes(body.status)) {
        await supabase
          .from("production_orders")
          .update({
            status: body.status === "cancelled" ? "cancelled" : "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("order_id", id);
      }
    }
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e, "Erro ao atualizar pedido.") }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase } = await requireUser();
    const { error } = await supabase.rpc("delete_order_with_stock_restore", { p_order: id });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: errorMessage(e, "Não foi possível excluir o pedido.") },
      { status: 500 }
    );
  }
}
