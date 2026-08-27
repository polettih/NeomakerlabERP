import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
const valid = ["Impressora FDM", "Impressora Resina", "Maquinário"];
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const { supabase, organizationId } = await requireUser();
    if (!b.name?.trim())
      return NextResponse.json({ error: "Nome do equipamento é obrigatório." }, { status: 400 });
    if (!valid.includes(b.category))
      return NextResponse.json({ error: "Tipo de equipamento inválido." }, { status: 400 });
    const purchase = Number(b.purchase_value || 0),
      useful = Number(b.useful_hours || 0);
    const { data, error } = await supabase
      .from("machines")
      .insert({
        organization_id: organizationId,
        name: b.name.trim(),
        category: b.category,
        power_kw: Number(b.power_kw || 0),
        purchase_value: purchase,
        useful_hours: useful,
        depreciation_per_hour: useful > 0 ? purchase / useful : 0,
        active: b.active !== false,
        notes: b.notes || null,
        purchase_date: b.purchase_date || null,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Erro ao cadastrar equipamento." },
      { status: 500 }
    );
  }
}
export async function PATCH(req: Request) {
  try {
    const { supabase, organizationId } = await requireUser();
    const b = await req.json();
    if (!b.id) return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
    const { data: c, error: ce } = await supabase
      .from("machines")
      .select("*")
      .eq("id", b.id)
      .eq("organization_id", organizationId)
      .single();
    if (ce) throw ce;
    const purchase =
        b.purchase_value === undefined ? Number(c.purchase_value) : Number(b.purchase_value || 0),
      useful = b.useful_hours === undefined ? Number(c.useful_hours) : Number(b.useful_hours || 0);
    const update: any = {};
    for (const k of [
      "name",
      "category",
      "power_kw",
      "purchase_value",
      "useful_hours",
      "active",
      "notes",
      "purchase_date",
    ])
      if (b[k] !== undefined)
        update[k] = ["power_kw", "purchase_value", "useful_hours"].includes(k)
          ? Number(b[k] || 0)
          : b[k];
    update.depreciation_per_hour = useful > 0 ? purchase / useful : 0;
    const { data, error } = await supabase
      .from("machines")
      .update(update)
      .eq("id", b.id)
      .eq("organization_id", organizationId)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Erro ao atualizar equipamento." },
      { status: 500 }
    );
  }
}
export async function DELETE(req: Request) {
  try {
    const { supabase, organizationId } = await requireUser();
    const b = await req.json();
    if (!b.id) return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
    const { error } = await supabase
      .from("machines")
      .update({ active: false })
      .eq("id", b.id)
      .eq("organization_id", organizationId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Erro ao desativar equipamento." },
      { status: 500 }
    );
  }
}
