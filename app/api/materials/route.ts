import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
export async function POST(req: Request) {
  try {
    const b = await req.json();
    if (!b.name?.trim())
      return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });
    const { supabase, organizationId } = await requireUser();
    const materialType = b.material_type || "Outro";
    const unit =
      materialType === "Filamento" ? "g" : materialType === "Resina" ? "ml" : b.unit || "un";
    if ((materialType === "Filamento" || materialType === "Resina") && !b.color_name)
      return NextResponse.json(
        { error: "Informe a cor para filamento ou resina." },
        { status: 400 }
      );
    const { data, error } = await supabase
      .from("materials")
      .insert({
        organization_id: organizationId,
        name: b.name.trim(),
        category: b.category || "Insumos",
        material_type: materialType,
        color_name: b.color_name || null,
        color_hex: b.color_hex || null,
        unit,
        minimum_stock: Number(b.minimum_stock || 0),
        supplier: b.supplier || null,
        notes: b.notes || null,
        active: true,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: unknown) {
    return NextResponse.json({ error: errorMessage(e, "Erro.") }, { status: 500 });
  }
}
export async function PATCH(req: Request) {
  try {
    const b = await req.json();
    if (!b.id) return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
    const { supabase, organizationId } = await requireUser();
    const { data: current, error: ce } = await supabase
      .from("materials")
      .select("*")
      .eq("id", b.id)
      .eq("organization_id", organizationId)
      .single();
    if (ce) throw ce;
    const update: Record<string, unknown> = {};
    for (const k of [
      "name",
      "category",
      "material_type",
      "color_name",
      "color_hex",
      "supplier",
      "notes",
      "active",
    ])
      if (b[k] !== undefined) update[k] = b[k];
    if (b.minimum_stock !== undefined) update.minimum_stock = Number(b.minimum_stock);
    if (b.material_type !== undefined)
      update.unit =
        b.material_type === "Filamento"
          ? "g"
          : b.material_type === "Resina"
            ? "ml"
            : b.unit || current.unit || "un";
    if (
      (update.material_type || current.material_type) === "Filamento" ||
      (update.material_type || current.material_type) === "Resina"
    ) {
      if (!((update.color_name ?? current.color_name) || "").trim())
        return NextResponse.json(
          { error: "Informe a cor para filamento ou resina." },
          { status: 400 }
        );
    }
    const { data, error } = await supabase
      .from("materials")
      .update(update)
      .eq("id", b.id)
      .eq("organization_id", organizationId)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: unknown) {
    return NextResponse.json({ error: errorMessage(e, "Erro.") }, { status: 500 });
  }
}
export async function DELETE(req: Request) {
  try {
    const b = await req.json();
    if (!b.id) return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
    const { supabase, organizationId } = await requireUser();
    const { error } = await supabase
      .from("materials")
      .update({ active: false })
      .eq("id", b.id)
      .eq("organization_id", organizationId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: errorMessage(e, "Erro ao excluir material.") }, { status: 500 });
  }
}
