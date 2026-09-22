import * as XLSX from "xlsx";

export type SheetRow = Record<string, string>;

/** Lê um arquivo .xlsx/.xls/.csv e devolve os cabeçalhos e as linhas como
 * texto simples. Usa a primeira aba da planilha. */
export async function parseSpreadsheet(
  file: File
): Promise<{ headers: string[]; rows: SheetRow[] }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<SheetRow>(sheet, { defval: "" });
  if (!rows.length) throw new Error("A planilha está vazia ou não pôde ser lida.");
  return { headers: Object.keys(rows[0]), rows };
}

export function normalizeText(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}
