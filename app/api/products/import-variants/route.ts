import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { guessUnits } from "@/lib/variants";

type Row = {
  shopee_id?: string;
  product_name: string;
  parent_sku?: string;
  variation_id?: string;
  variation_name: string;
  variation_sku?: string;
  price: number;
};

const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/**
 * Cria as variações de cada produto a partir das linhas do relatório de vendas da Shopee
 * (mass_update_sales_info: uma linha por variação). Só ADICIONA variações que ainda não
 * existem (pelo nome) — nunca altera nem apaga as que já estão cadastradas.
 */
export async function POST(request: Request) {
  const { supabase, organizationId } = await requireUser();
  try {
    const body = await request.json();
    const rows = (body.rows ?? []) as Row[];
    if (!rows.length)
      return NextResponse.json({ error: "Nenhuma linha para importar." }, { status: 400 });
    if (rows.length > 2000)
      return NextResponse.json({ error: "Máximo de 2000 linhas por importação." }, { status: 400 });

    const { data: products, error: pe } = await supabase
      .from("products")
      .select("id,name,sku,sale_price,external_ids")
      .eq("organization_id", organizationId);
    if (pe) throw pe;
    const { data: existingVariants, error: ve } = await supabase
      .from("product_variants")
      .select("id,product_id,name,sort_order")
      .eq("organization_id", organizationId);
    if (ve) throw ve;

    // Agrupa as linhas por produto (ID da Shopee, ou nome quando não há ID).
    const groups = new Map<string, Row[]>();
    for (const row of rows) {
      const key = row.shopee_id?.trim() || `name:${normalize(row.product_name || "")}`;
      if (!row.variation_name?.trim() || !row.product_name?.trim()) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }

    let created = 0,
      skipped = 0;
    const notFound: string[] = [];
    const errors: string[] = [];

    for (const [, list] of groups) {
      const first = list[0];
      const product =
        (first.shopee_id &&
          products?.find(
            (p) => (p.external_ids as Record<string, string> | null)?.shopee === first.shopee_id
          )) ||
        products?.find((p) => normalize(p.name) === normalize(first.product_name));
      if (!product) {
        notFound.push(first.product_name);
        continue;
      }
      const mine = (existingVariants ?? []).filter((v) => v.product_id === product.id);
      const have = new Set(mine.map((v) => normalize(v.name)));
      let order = mine.reduce((m, v) => Math.max(m, v.sort_order ?? 0), -1) + 1;
      const toInsert = [];
      for (const row of list) {
        const name = row.variation_name.trim();
        if (have.has(normalize(name))) {
          skipped++;
          continue;
        }
        have.add(normalize(name));
        toInsert.push({
          organization_id: organizationId,
          product_id: product.id,
          name,
          sku: row.variation_sku?.trim() || null,
          sale_price: Math.max(Number(row.price) || 0, 0),
          units: guessUnits(name),
          active: true,
          sort_order: order++,
          external_ids: row.variation_id ? { shopee: row.variation_id } : {},
        });
      }
      if (toInsert.length) {
        const { error } = await supabase.from("product_variants").insert(toInsert);
        if (error) {
          errors.push(`${product.name}: ${errorMessage(error, "erro ao salvar variações")}`);
          continue;
        }
        created += toInsert.length;
        // Produto importado sem preço/SKU: aproveita o que a planilha trouxe, sem sobrescrever.
        const patch: Record<string, unknown> = {};
        if (!(Number(product.sale_price) > 0)) {
          const prices = toInsert.map((v) => v.sale_price).filter((v) => v > 0);
          if (prices.length) patch.sale_price = Math.min(...prices);
        }
        if (!product.sku && first.parent_sku?.trim()) patch.sku = first.parent_sku.trim();
        if (Object.keys(patch).length) {
          // SKU duplicado (unique por organização) não pode derrubar a importação.
          const { error } = await supabase
            .from("products")
            .update(patch)
            .eq("id", product.id)
            .eq("organization_id", organizationId);
          if (error && patch.sku) {
            delete patch.sku;
            if (Object.keys(patch).length)
              await supabase
                .from("products")
                .update(patch)
                .eq("id", product.id)
                .eq("organization_id", organizationId);
          }
        }
      }
    }
    return NextResponse.json({ created, skipped, notFound, errors });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e, "Erro interno") }, { status: 500 });
  }
}
