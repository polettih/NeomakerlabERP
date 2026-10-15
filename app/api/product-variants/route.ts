import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";

type Input = {
  id?: string;
  name: string;
  sku?: string | null;
  sale_price: number | string;
  units?: number | string;
  cost_override?: number | string | null;
  active?: boolean;
};

export async function GET(req: Request) {
  try {
    const { supabase, organizationId } = await requireUser();
    const productId = new URL(req.url).searchParams.get("product_id");
    if (!productId) return NextResponse.json({ error: "product_id obrigatório." }, { status: 400 });
    const { data, error } = await supabase
      .from("product_variants")
      .select("id,product_id,name,sku,sale_price,units,cost_override,active,sort_order")
      .eq("organization_id", organizationId)
      .eq("product_id", productId)
      .order("sort_order")
      .order("name");
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (e) {
    return NextResponse.json(
      { error: errorMessage(e, "Erro ao carregar variações.") },
      { status: 500 }
    );
  }
}

/**
 * Sincroniza a lista completa de variações de um produto: atualiza as que já existem
 * (pelo id), cria as novas e remove as que saíram da lista. Pedidos antigos mantêm o
 * nome da variação gravado no item, então apagar uma variação não quebra o histórico.
 */
export async function PUT(req: Request) {
  try {
    const { supabase, organizationId } = await requireUser();
    const body = await req.json();
    const productId = String(body.product_id || "");
    const list = (body.variants ?? []) as Input[];
    if (!productId) return NextResponse.json({ error: "product_id obrigatório." }, { status: 400 });

    const { data: product } = await supabase
      .from("products")
      .select("id")
      .eq("id", productId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!product) return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });

    const seen = new Set<string>();
    const rows = list.map((v, idx) => {
      const name = String(v.name ?? "").trim();
      if (!name) throw new Error("Toda variação precisa de um nome.");
      const key = name.toLowerCase();
      if (seen.has(key)) throw new Error(`Variação repetida: "${name}".`);
      seen.add(key);
      const price = Number(v.sale_price);
      if (!Number.isFinite(price) || price < 0) throw new Error(`Preço inválido em "${name}".`);
      const units = Number(v.units ?? 1);
      if (!Number.isFinite(units) || units <= 0)
        throw new Error(`Unidades inválidas em "${name}".`);
      const hasCost =
        v.cost_override !== null && v.cost_override !== undefined && String(v.cost_override) !== "";
      const cost = hasCost ? Number(v.cost_override) : null;
      if (cost !== null && (!Number.isFinite(cost) || cost < 0))
        throw new Error(`Custo inválido em "${name}".`);
      return {
        id: v.id,
        organization_id: organizationId,
        product_id: productId,
        name,
        sku: v.sku?.toString().trim() || null,
        sale_price: price,
        units,
        cost_override: cost,
        active: v.active !== false,
        sort_order: idx,
        updated_at: new Date().toISOString(),
      };
    });

    const { data: current, error: ce } = await supabase
      .from("product_variants")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("product_id", productId);
    if (ce) throw ce;
    const keepIds = new Set(rows.map((r) => r.id).filter(Boolean) as string[]);
    const toDelete = (current ?? []).map((c) => c.id).filter((id) => !keepIds.has(id));
    // Remove primeiro: evita conflito de nome (unique product_id+name) com variações renomeadas.
    if (toDelete.length) {
      const { error } = await supabase
        .from("product_variants")
        .delete()
        .eq("organization_id", organizationId)
        .in("id", toDelete);
      if (error) throw error;
    }
    for (const r of rows) {
      const { id, ...fields } = r;
      if (id) {
        const { error } = await supabase
          .from("product_variants")
          .update(fields)
          .eq("id", id)
          .eq("organization_id", organizationId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("product_variants").insert(fields);
        if (error) throw error;
      }
    }
    return NextResponse.json({ ok: true, count: rows.length });
  } catch (e) {
    return NextResponse.json(
      { error: errorMessage(e, "Erro ao salvar variações.") },
      { status: 500 }
    );
  }
}
