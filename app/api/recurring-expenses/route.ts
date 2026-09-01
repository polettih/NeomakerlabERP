import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.description)
      return NextResponse.json({ error: "Descrição é obrigatória." }, { status: 400 });
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0)
      return NextResponse.json({ error: "Informe um valor válido." }, { status: 400 });
    const dayOfMonth = Math.min(Math.max(Number(body.day_of_month) || 1, 1), 28);
    const category =
      body.category && EXPENSE_CATEGORIES.includes(body.category)
        ? body.category
        : body.category || null;

    const { supabase, organizationId } = await requireUser();
    const { data, error } = await supabase
      .from("recurring_expenses")
      .insert({
        organization_id: organizationId,
        description: body.description,
        category,
        amount,
        day_of_month: dayOfMonth,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e, "Erro interno") }, { status: 500 });
  }
}
