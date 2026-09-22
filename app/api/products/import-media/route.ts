import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";

type Row = { product_name: string; image_urls: string[] };

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

    let productsUpdated = 0,
      photosAdded = 0;
    const notFound: string[] = [];

    for (const row of rows) {
      const name = String(row.product_name || "").trim();
      const urls = (row.image_urls || []).map((u) => String(u).trim()).filter(Boolean);
      if (!name || !urls.length) continue;
      const product = products?.find((p) => normalize(p.name) === normalize(name));
      if (!product) {
        notFound.push(name);
        continue;
      }
      const { data: existing } = await supabase
        .from("product_images")
        .select("public_url, sort_order")
        .eq("product_id", product.id)
        .eq("organization_id", organizationId);
      const already = new Set((existing ?? []).map((i) => i.public_url));
      let nextOrder = (existing ?? []).length
        ? Math.max(...(existing ?? []).map((i) => i.sort_order)) + 1
        : 0;
      const toInsert = urls
        .filter((u) => !already.has(u))
        .slice(0, Math.max(0, 8 - (existing ?? []).length))
        .map((u) => ({
          product_id: product.id,
          organization_id: organizationId,
          // Não hospedamos a foto no nosso storage — usamos o link direto do CDN
          // da Shopee. O prefixo "external:" avisa a rota de exclusão que não há
          // arquivo correspondente no nosso bucket pra apagar.
          storage_path: `external:${u}`,
          public_url: u,
          sort_order: nextOrder++,
        }));
      if (!toInsert.length) continue;
      const { error: ie } = await supabase.from("product_images").insert(toInsert);
      if (ie) {
        notFound.push(`${name} (erro ao salvar fotos: ${ie.message})`);
        continue;
      }
      productsUpdated++;
      photosAdded += toInsert.length;
    }

    return NextResponse.json({ productsUpdated, photosAdded, notFound });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e, "Erro interno") }, { status: 500 });
  }
}
