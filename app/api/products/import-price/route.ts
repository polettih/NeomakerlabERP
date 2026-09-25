import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";

type Row = { product_name: string; price: number };

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
    if (!rows.length)
      return NextResponse.json({ error: "Nenhuma linha para importar." }, { status: 400 });

    const { data: products, error: pe } = await supabase
      .from("products")
      .select("id,name")
      .eq("organization_id", organizationId);
    if (pe) throw pe;

    let updated = 0;
    const notFound: string[] = [];

    for (const row of rows) {
      const name = String(row.product_name || "").trim();
      const price = Number(row.price || 0);
      if (!name || !(price > 0)) continue;
      const product = products?.find((p) => normalize(p.name) === normalize(name));
      if (!product) {
        notFound.push(name);
        continue;
      }
      const { error } = await supabase
        .from("products")
        .update({ sale_price: price })
        .eq("id", product.id)
        .eq("organization_id", organizationId);
      if (error) {
        notFound.push(`${name} (erro ao salvar: ${error.message})`);
        continue;
      }
      updated++;
    }

    return NextResponse.json({ updated, notFound });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e, "Erro interno") }, { status: 500 });
  }
}
