import * as XLSX from "xlsx";

export type SheetRow = Record<string, string>;

export function normalizeText(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// Os arquivos de "Editar em Massa" da Shopee (informações básicas, de mídia,
// de vendas...) têm linhas técnicas antes do cabeçalho de verdade (chaves
// internas tipo "et_title_product_id", metadados) e linhas de instrução logo
// depois ("Obrigatório", textos de ajuda) — nenhuma delas é dado de verdade.
// Em vez de assumir que a primeira linha é o cabeçalho, procura a linha que
// realmente tem "ID do Produto" ou "Nome do Produto" como célula.
const HEADER_MARKERS = ["id do produto", "nome do produto"];

/** Lê um arquivo .xlsx/.xls/.csv e devolve os cabeçalhos e as linhas de dados
 * como texto simples, pulando linhas técnicas/instrutivas quando o arquivo
 * seguir o padrão de exportação da Shopee. Usa a primeira aba da planilha. */
export async function parseSpreadsheet(
  file: File
): Promise<{ headers: string[]; rows: SheetRow[] }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  }) as unknown as string[][];
  if (!grid.length) throw new Error("A planilha está vazia ou não pôde ser lida.");

  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(grid.length, 15); i++) {
    const norm = (grid[i] ?? []).map((c) => normalizeText(String(c ?? "")));
    if (HEADER_MARKERS.some((m) => norm.includes(m))) {
      headerRowIdx = i;
      break;
    }
  }
  const headerRow = (grid[headerRowIdx] ?? []).map((h) => String(h ?? "").trim());
  const idColIdx = headerRow.findIndex((h) => normalizeText(h) === "id do produto");
  const nameColIdx = headerRow.findIndex((h) => normalizeText(h) === "nome do produto");
  // A coluna-âncora decide onde os dados de verdade começam: linhas de
  // instrução/ajuda vêm com essa célula vazia, diferente das linhas de dados.
  const anchorCol = idColIdx >= 0 ? idColIdx : nameColIdx >= 0 ? nameColIdx : 0;

  const rows: SheetRow[] = [];
  for (let i = headerRowIdx + 1; i < grid.length; i++) {
    const raw = grid[i] ?? [];
    if (!String(raw[anchorCol] ?? "").trim()) continue;
    const row: SheetRow = {};
    headerRow.forEach((h, idx) => {
      if (h) row[h] = String(raw[idx] ?? "");
    });
    rows.push(row);
  }
  if (!rows.length) throw new Error("Não encontrei nenhuma linha de dados nessa planilha.");
  return { headers: headerRow.filter(Boolean), rows };
}
