import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";

const num = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

/**
 * Recalcula o custo dos produtos com os preços médios ATUAIS dos materiais (que mudam a
 * cada compra). Só o custo de material, o desperdício, o total e o preço sugerido são
 * refeitos; horas, energia, depreciação, mão de obra e o preço de venda não são alterados.
 */
export async function POST() {
  try {
    const { supabase, organizationId } = await requireUser();
    const { data: products, error: pe } = await supabase
      .from("products")
      .select("id,estimated_cost")
      .eq("organization_id", organizationId);
    if (pe) throw pe;
    const ids = (products ?? []).map((p) => p.id);
    if (!ids.length) return NextResponse.json({ updated: 0, unchanged: 0 });
    const [{ data: pricing }, { data: links }, { data: materials }] = await Promise.all([
      supabase.from("product_pricing").select("*").in("product_id", ids),
      supabase
        .from("product_materials")
        .select("product_id,material_id,quantity")
        .in("product_id", ids),
      supabase.from("materials").select("id,average_cost").eq("organization_id", organizationId),
    ]);
    const avg = new Map((materials ?? []).map((m) => [m.id, num(m.average_cost)]));
    let updated = 0;
    let unchanged = 0;
    for (const pr of pricing ?? []) {
      const mine = (links ?? []).filter((l) => l.product_id === pr.product_id);
      if (!mine.length) continue;
      const materialCost = mine.reduce(
        (s, l) => s + num(l.quantity) * (avg.get(l.material_id) ?? 0),
        0
      );
      const waste = materialCost * num(pr.loss_percent);
      const extras = num(pr.painting_materials) + num(pr.packaging_cost) + num(pr.other_cost);
      const total =
        materialCost +
        waste +
        num(pr.energy_cost) +
        num(pr.depreciation_cost) +
        num(pr.labor_cost) +
        extras;
      const suggested = total * (1 + num(pr.margin_percent));
      const old = products?.find((p) => p.id === pr.product_id);
      if (
        Math.abs(total - num(pr.total_cost)) < 0.005 &&
        Math.abs(total - num(old?.estimated_cost)) < 0.005
      ) {
        unchanged++;
        continue;
      }
      const { error: e1 } = await supabase
        .from("product_pricing")
        .update({
          material_cost: materialCost,
          waste_cost: waste,
          total_cost: total,
          suggested_price: suggested,
          net_after_commission: suggested,
          profit: suggested - total,
        })
        .eq("product_id", pr.product_id);
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from("products")
        .update({ estimated_cost: total })
        .eq("id", pr.product_id)
        .eq("organization_id", organizationId);
      if (e2) throw e2;
      updated++;
    }
    return NextResponse.json({ updated, unchanged });
  } catch (e) {
    return NextResponse.json(
      { error: errorMessage(e, "Erro ao recalcular custos.") },
      { status: 500 }
    );
  }
}
