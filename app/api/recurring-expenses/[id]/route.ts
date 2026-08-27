import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { supabase, organizationId } = await requireUser();

    const update: Record<string, unknown> = {};
    if (body.description !== undefined) {
      if (!String(body.description).trim())
        return NextResponse.json({ error: "Descrição é obrigatória." }, { status: 400 });
      update.description = body.description;
    }
    if (body.category !== undefined) {
      update.category =
        body.category && EXPENSE_CATEGORIES.includes(body.category)
          ? body.category
          : body.category || null;
    }
    if (body.amount !== undefined) {
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0)
        return NextResponse.json({ error: "Informe um valor válido." }, { status: 400 });
      update.amount = amount;
    }
    if (body.day_of_month !== undefined) {
      update.day_of_month = Math.min(Math.max(Number(body.day_of_month) || 1, 1), 28);
    }
    if (body.active !== undefined) update.active = Boolean(body.active);

    if (!Object.keys(update).length)
      return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });

    const { data, error } = await supabase
      .from("recurring_expenses")
      .update(update)
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, organizationId } = await requireUser();
    const { error } = await supabase
      .from("recurring_expenses")
      .delete()
      .eq("id", id)
      .eq("organization_id", organizationId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro interno" }, { status: 500 });
  }
}
