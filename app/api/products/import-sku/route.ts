import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";

type Row = { product_name: string; sku: string };

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export async function POST(request: Request) {
  const { supabase, organizationId } = await requireUser();
  try {
    const body = await request.json();
    const rows = (body.rows ?? []) as Row[];
    const overwrite = body.overwrite === true;
    if (!rows.length)
      return NextResponse.json({ error: "Nenhuma linha para importar." }, { status: 400 });

    const { data: products, error: pe } = await supabase
      .from("products")
      .select("id,name,sku")
      .eq("organization_id", organizationId);
    if (pe) throw pe;

    let updated = 0,
      skipped = 0;
    const notFound: string[] = [];

    for (const row of rows) {
      const name = String(row.product_name || "").trim();
      const sku = String(row.sku || "").trim();
      if (!name || !sku) continue;
      const product = products?.find((p) => normalize(p.name) === normalize(name));
      if (!product) {
        notFound.push(name);
        continue;
      }
      if (product.sku && !overwrite) {
        skipped++;
        continue;
      }
      const { error } = await supabase
        .from("products")
        .update({ sku })
        .eq("id", product.id)
        .eq("organization_id", organizationId);
      if (error) {
        // SKU duplicado (unique por organização) — não interrompe o resto da importação.
        notFound.push(`${name} (SKU "${sku}" já usado em outro produto)`);
        continue;
      }
      updated++;
    }

    return NextResponse.json({ updated, skipped, notFound });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e, "Erro interno") }, { status: 500 });
  }
}
