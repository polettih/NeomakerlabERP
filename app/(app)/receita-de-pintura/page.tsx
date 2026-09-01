import { requireUser } from "@/lib/auth";
import { CreatePaintingRecipeForm } from "@/components/create-painting-recipe-form";
import { RecipeTemplateButton } from "@/components/recipe-template-button";
import { RecipeLibrary, type Recipe, type RecipeStep } from "@/components/recipe-library";

type RecipeImage = { public_url: string; sort_order: number };
type RecipeRow = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  colors: string[] | null;
  dilution: string | null;
  finish: string | null;
  notes: string | null;
  steps: RecipeStep[] | null;
  products: { name: string; product_images: RecipeImage[] | null }[] | null;
};

export default async function ReceitaPinturaPage() {
  const { supabase } = await requireUser();
  const [{ data: recipes }, { data: templates }, { data: products }] = await Promise.all([
    supabase
      .from("painting_recipes")
      .select(
        "id,name,category,description,colors,dilution,finish,notes,steps,created_at,products(name,product_images(public_url,sort_order))"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("painting_recipe_templates")
      .select("id,name,category,description,colors,dilution,finish,notes,steps")
      .order("category")
      .order("name"),
    supabase.from("products").select("id,name").order("name"),
  ]);

  const mapped: Recipe[] = (recipes ?? []).map((x: RecipeRow) => {
    const product = x.products?.[0] ?? null;
    const sortedImages = (product?.product_images ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order);
    return {
      id: x.id,
      name: x.name,
      category: x.category,
      description: x.description,
      colors: x.colors,
      dilution: x.dilution,
      finish: x.finish,
      notes: x.notes,
      steps: x.steps,
      product_name: product?.name ?? null,
      product_thumb: sortedImages[0]?.public_url ?? null,
    };
  });

  return (
    <div className="content">
      <div className="section-title">
        <div>
          <h1>Receita de pintura</h1>
          <p className="muted">
            Passo a passo pra repetir suas pinturas com consistência — marque cada etapa enquanto
            pinta.
          </p>
        </div>
      </div>
      <div className="grid two-col">
        <CreatePaintingRecipeForm products={products ?? []} />
        <div className="card">
          <h2>Receitas iniciais</h2>
          <p className="muted">
            São pontos de partida. Ajuste conforme a marca da tinta, aerógrafo/pincel e
            referência.
          </p>
          <div className="grid">
            {(templates ?? []).map((t) => (
              <div key={t.id} className="card" style={{ padding: 14 }}>
                <div className="section-title">
                  <div>
                    <strong>{t.name}</strong>
                    <div className="muted">{t.category}</div>
                  </div>
                  <RecipeTemplateButton template={t} />
                </div>
                <p>{t.description}</p>
                {!!t.colors?.length && (
                  <div className="muted">
                    <strong>Cores:</strong> {t.colors.join(", ")}
                  </div>
                )}
                {t.dilution && (
                  <div className="muted">
                    <strong>Diluição:</strong> {t.dilution}
                  </div>
                )}
                {t.finish && (
                  <div className="muted">
                    <strong>Acabamento:</strong> {t.finish}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <RecipeLibrary recipes={mapped} />
    </div>
  );
}
