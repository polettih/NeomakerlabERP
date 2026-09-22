"use client";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { errorMessage } from "@/lib/errors";

type ExistingProduct = { id: string; name: string; external_ids: Record<string, string> | null };

type ParsedProduct = {
  shopee_id: string;
  name: string;
  description: string;
  images: string[];
};

// As planilhas de "atualização em massa" da Shopee sempre têm as mesmas 6 linhas de
// cabeçalho/instruções antes dos dados de verdade começarem. Em vez de contar linhas
// fixas (frágil — pode mudar entre exportações), acha a primeira linha cuja coluna A é
// um ID de produto (só dígitos, 5+ caracteres) — assim funciona mesmo que a Shopee mude
// o layout do cabeçalho de novo.
function findDataStart(rows: unknown[][]): number {
  for (let i = 0; i < rows.length; i++) {
    const first = String(rows[i]?.[0] ?? "").trim();
    if (/^\d{5,}$/.test(first)) return i;
  }
  return -1;
}

async function readSheet(file: File): Promise<unknown[][]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
}

export function ProductImport({ existingProducts }: { existingProducts: ExistingProduct[] }) {
  const r = useRouter();
  const basicRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<HTMLInputElement>(null);
  const [basicFile, setBasicFile] = useState<File | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedProduct[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    linked: number;
    errors: { name: string; reason: string }[];
  } | null>(null);

  const linkedIds = useMemo(() => {
    const set = new Set<string>();
    for (const p of existingProducts) {
      const id = p.external_ids?.shopee;
      if (id) set.add(id);
    }
    return set;
  }, [existingProducts]);

  async function parseFiles() {
    setError("");
    if (!basicFile || !mediaFile) {
      setError("Selecione as duas planilhas (dados básicos e mídia).");
      return;
    }
    try {
      const [basicRows, mediaRows] = await Promise.all([readSheet(basicFile), readSheet(mediaFile)]);
      const basicStart = findDataStart(basicRows);
      const mediaStart = findDataStart(mediaRows);
      if (basicStart < 0) throw new Error("Não encontrei dados na planilha de dados básicos.");
      if (mediaStart < 0) throw new Error("Não encontrei dados na planilha de mídia.");

      const byId = new Map<string, ParsedProduct>();
      for (let i = basicStart; i < basicRows.length; i++) {
        const row = basicRows[i];
        const id = String(row[0] ?? "").trim();
        if (!id) continue;
        byId.set(id, {
          shopee_id: id,
          name: String(row[2] ?? "").trim(),
          description: String(row[3] ?? "").trim(),
          images: [],
        });
      }
      for (let i = mediaStart; i < mediaRows.length; i++) {
        const row = mediaRows[i];
        const id = String(row[0] ?? "").trim();
        if (!id) continue;
        // Colunas E a M (índices 4 a 12): imagem de capa + imagens 1 a 8.
        const images = row
          .slice(4, 13)
          .map((v) => String(v ?? "").trim())
          .filter((v) => /^https?:\/\//.test(v));
        const existing = byId.get(id);
        if (existing) existing.images = images;
        else
          byId.set(id, {
            shopee_id: id,
            name: String(row[2] ?? "").trim(),
            description: "",
            images,
          });
      }
      const list = [...byId.values()].filter((p) => p.name);
      if (!list.length) throw new Error("Nenhum produto encontrado nas planilhas.");
      setParsed(list);
    } catch (e) {
      setError(errorMessage(e, "Não consegui ler essas planilhas."));
    }
  }

  async function submit() {
    if (!parsed) return;
    const toImport = parsed.filter((p) => !linkedIds.has(p.shopee_id));
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: toImport }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Erro ao importar.");
      setResult({ ...j, linked: parsed.length - toImport.length });
      r.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setBasicFile(null);
    setMediaFile(null);
    setParsed(null);
    setResult(null);
    setError("");
    if (basicRef.current) basicRef.current.value = "";
    if (mediaRef.current) mediaRef.current.value = "";
  }

  const newCount = parsed ? parsed.filter((p) => !linkedIds.has(p.shopee_id)).length : 0;

  return (
    <div className="card">
      <div className="section-title">
        <div>
          <h2>Importar produtos da Shopee</h2>
          <p className="muted">
            Suba as duas planilhas de &quot;Atualização em massa&quot; exportadas do Gerenciador de
            Produtos da Shopee (dados básicos + mídia) — o sistema junta as duas pelo ID do
            produto e já cadastra tudo com as fotos.
          </p>
        </div>
        {(parsed || result) && (
          <button className="btn btn-secondary btn-sm" onClick={reset}>
            Recomeçar
          </button>
        )}
      </div>
      {error && <div className="error">{error}</div>}

      {!parsed && !result && (
        <>
          <div className="form-grid">
            <div className="field">
              <label>Planilha de dados básicos (mass_update_basic_info)</label>
              <input
                ref={basicRef}
                className="input"
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setBasicFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="field">
              <label>Planilha de mídia/fotos (mass_update_media_info)</label>
              <input
                ref={mediaRef}
                className="input"
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setMediaFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <button className="btn btn-primary" onClick={parseFiles}>
            Ver prévia
          </button>
        </>
      )}

      {parsed && !result && (
        <>
          <p className="muted">
            {parsed.length} produtos encontrados — <strong>{newCount} novos</strong> serão
            cadastrados
            {parsed.length - newCount > 0 && (
              <> ({parsed.length - newCount} já foram importados antes e serão ignorados)</>
            )}
            .
          </p>
          <div style={{ maxHeight: 420, overflow: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Foto</th>
                  <th>Produto</th>
                  <th>Fotos</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {parsed.map((p) => (
                  <tr key={p.shopee_id}>
                    <td>
                      {p.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.images[0]} alt="" className="product-thumb" />
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>{p.name}</td>
                    <td>{p.images.length}</td>
                    <td>
                      {linkedIds.has(p.shopee_id) ? (
                        <span className="badge">Já importado</span>
                      ) : (
                        <span className="badge green">Novo</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ marginTop: 8 }}>
            Produtos novos entram com preço de venda e custo em R$ 0,00 — a Shopee não exporta
            essa informação, então acesse Produtos depois da importação para preencher a
            precificação de cada um.
          </p>
          <button
            className="btn btn-primary"
            onClick={submit}
            disabled={busy || newCount === 0}
            style={{ marginTop: 12 }}
          >
            {busy ? "Importando..." : `Importar ${newCount} produtos novos`}
          </button>
        </>
      )}

      {result && (
        <div>
          <p>
            ✅ <strong>{result.created}</strong> produto(s) criado(s), com fotos já anexadas.
            {result.linked > 0 && (
              <>
                {" "}
                <strong>{result.linked}</strong> já existiam e foram ignorados.
              </>
            )}
          </p>
          {result.errors.length > 0 && (
            <>
              <p className="muted">{result.errors.length} produto(s) com problema:</p>
              <ul>
                {result.errors.map((e, i) => (
                  <li key={i} className="muted">
                    {e.name}: {e.reason}
                  </li>
                ))}
              </ul>
            </>
          )}
          <button className="btn btn-secondary" onClick={reset}>
            Importar outro arquivo
          </button>
        </div>
      )}
    </div>
  );
}
