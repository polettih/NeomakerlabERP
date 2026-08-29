import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
export async function POST(request: Request) {
  try {
    const { supabase, organizationId } = await requireUser();
    const body = await request.json();
    if (!body.description || Number(body.amount) <= 0)
      return NextResponse.json({ error: "Serviço e valor são obrigatórios." }, { status: 400 });
    const { data, error } = await supabase
      .from("painting_revenues")
      .insert({
        organization_id: organizationId,
        description: body.description,
        customer_name: body.customer_name || null,
        amount: Number(body.amount),
        painting_date: body.painting_date || new Date().toISOString(),
        status: "received",
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro interno" }, { status: 500 });
  }
}
