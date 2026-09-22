import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";

type ImportItem = {
  shopee_id: string;
  name: string;
  description?: string;
  images?: string[];
};

const MAX_ITEMS = 200;
const MAX_IMAGES_PER_PRODUCT = 8;

export async function POST(request: Request) {
  const { supabase, organizationId } = await requireUser();
  try {
    const body = await request.json();
    const items = (body.items ?? []) as ImportItem[];
    if (!items.length)
      return NextResponse.json({ error: "Nenhum produto novo para importar." }, { status: 400 });
    if (items.length > MAX_ITEMS)
      return NextResponse.json(
        { error: `Máximo de ${MAX_ITEMS} produtos por importação. Divida em partes menores.` },
        { status: 400 }
      );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Sessão expirada.");

    let created = 0;
    const errors: { name: string; reason: string }[] = [];

    for (const item of items) {
      try {
        if (!item.shopee_id || !item.name?.trim()) {
          errors.push({ name: item.name || "(sem nome)", reason: "Faltam dados obrigatórios." });
          continue;
        }
        // Idempotência: se esse ID da Shopee já foi importado antes (checagem dupla,
        // além do filtro feito no cliente), pula em vez de duplicar o produto.
        const { data: existing } = await supabase
          .from("products")
          .select("id")
          .eq("organization_id", organizationId)
          .contains("external_ids", { shopee: item.shopee_id })
          .maybeSingle();
        if (existing) continue;

        const { data: product, error: pe } = await supabase
          .from("products")
          .insert({
            organization_id: organizationId,
            name: item.name.trim(),
            description: item.description?.trim() || null,
            category: "Outros",
            sale_price: 0,
            estimated_cost: 0,
            active: true,
            external_ids: { shopee: item.shopee_id },
          })
          .select("id")
          .single();
        if (pe) throw pe;

        const urls = (item.images ?? []).slice(0, MAX_IMAGES_PER_PRODUCT);
        let sortOrder = 0;
        for (const url of urls) {
          try {
            const imgRes = await fetch(url);
            if (!imgRes.ok) continue;
            const contentType = imgRes.headers.get("content-type") || "image/jpeg";
            const ext = contentType.includes("png")
              ? "png"
              : contentType.includes("webp")
                ? "webp"
                : "jpg";
            const buf = new Uint8Array(await imgRes.arrayBuffer());
            const path = `${user.id}/${product.id}/${crypto.randomUUID()}.${ext}`;
            const up = await supabase.storage
              .from("product-images")
              .upload(path, buf, { contentType });
            if (up.error) continue;
            const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
            await supabase.from("product_images").insert({
              product_id: product.id,
              storage_path: path,
              public_url: pub.publicUrl,
              sort_order: sortOrder++,
            });
          } catch {
            // Uma imagem que falha não derruba o produto inteiro — só fica sem essa foto.
          }
        }
        created++;
      } catch (e) {
        errors.push({ name: item.name || item.shopee_id, reason: errorMessage(e, "Erro ao importar.") });
      }
    }

    return NextResponse.json({ created, errors });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e, "Erro interno") }, { status: 500 });
  }
}
