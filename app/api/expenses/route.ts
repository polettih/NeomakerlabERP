import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";
import { errorMessage } from "@/lib/errors";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.description || !body.amount) {
      return NextResponse.json({ error: "Descrição e valor são obrigatórios." }, { status: 400 });
    }
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Informe um valor válido." }, { status: 400 });
    }
    const category =
      body.category && EXPENSE_CATEGORIES.includes(body.category)
        ? body.category
        : body.category || null;
    const status = body.status === "paid" ? "paid" : "pending";
    const dueDate = body.due_date || null;
    const paidAt = status === "paid" ? body.paid_at || new Date().toISOString() : null;

    const { supabase, organizationId } = await requireUser();
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        organization_id: organizationId,
        description: body.description,
        category,
        amount,
        status,
        due_date: dueDate,
        paid_at: paidAt,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: unknown) {
    return NextResponse.json({ error: errorMessage(e, "Erro interno") }, { status: 500 });
  }
}
