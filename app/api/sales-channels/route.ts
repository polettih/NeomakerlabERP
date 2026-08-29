import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { supabase, organizationId } = await requireUser();
    if (!String(body.name || "").trim())
      return NextResponse.json({ error: "Nome do canal é obrigatório." }, { status: 400 });
    const { data, error } = await supabase
      .from("sales_channels")
      .insert({
        organization_id: organizationId,
        name: String(body.name).trim(),
        active: body.active !== false,
        fee_percent: Math.max(0, Math.min(1, Number(body.fee_percent || 0))),
        fixed_fee: Math.max(0, Number(body.fixed_fee || 0)),
      })
      .select()
      .single();
    if (error) {
      if (error.code === "23505")
        throw new Error("Já existe um canal com esse nome nesta organização.");
      throw error;
    }
    return NextResponse.json(data);
  } catch (e: unknown) {
    return NextResponse.json({ error: errorMessage(e, "Erro ao criar canal.") }, { status: 500 });
  }
}
