import { parseSpreadsheet, normalizeText } from "@/lib/parse-spreadsheet";

export type VariantRow = {
  shopee_id: string;
  product_name: string;
  parent_sku: string;
  variation_id: string;
  variation_name: string;
  variation_sku: string;
  price: number;
};

const col = (headers: string[], names: string[]) =>
  headers.find((h) => names.includes(normalizeText(h))) ?? "";

/**
 * Lê o relatório "Vendas" (mass_update_sales_info) da Shopee: uma linha por variação,
 * com ID/nome do produto, nome da variação ("Nome"), SKU da variação e preço. Linhas de
 * produtos sem variação (coluna "Nome" vazia) são ignoradas aqui.
 */
export async function parseVariantRows(file: File): Promise<{ rows: VariantRow[]; total: number }> {
  const { headers, rows } = await parseSpreadsheet(file);
  const cId = col(headers, ["id do produto"]);
  const cProd = col(headers, ["nome do produto"]);
  const cVarId = col(headers, ["variante identificador"]);
  const cName = col(headers, ["nome"]);
  const cParent = col(headers, ["sku de referencia"]);
  const cSku = col(headers, ["sku"]);
  const cPrice = col(headers, ["preco"]);
  if (!cId || !cName || !cPrice)
    throw new Error(
      'Esse não parece ser o relatório de Vendas da Shopee (faltam as colunas "ID do Produto", "Nome" e "Preço").'
    );
  const out: VariantRow[] = [];
  for (const r of rows) {
    const variation_name = String(r[cName] ?? "").trim();
    if (!variation_name) continue;
    out.push({
      shopee_id: String(r[cId] ?? "").trim(),
      product_name: String(r[cProd] ?? "").trim(),
      parent_sku: String(r[cParent] ?? "").trim(),
      variation_id: String(r[cVarId] ?? "").trim(),
      variation_name,
      variation_sku: String(r[cSku] ?? "").trim(),
      price: Number(String(r[cPrice] ?? "").replace(",", ".")) || 0,
    });
  }
  if (!out.length) throw new Error("Nenhuma variação encontrada nessa planilha.");
  return { rows: out, total: rows.length };
}
