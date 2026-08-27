import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.name) return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });
    const { supabase } = await requireUser();
    const { data: member } = await supabase
      .from("organization_members")
      .select("organization_id")
      .limit(1)
      .single();
    if (!member) throw new Error("Organização não encontrada.");
    const { data, error } = await supabase
      .from("products")
      .insert({
        organization_id: member.organization_id,
        name: body.name,
        sale_price: Number(body.sale_price || 0),
        estimated_cost: Number(body.estimated_cost || 0),
        category: body.category || "Bonecos",
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro interno" }, { status: 500 });
  }
}
