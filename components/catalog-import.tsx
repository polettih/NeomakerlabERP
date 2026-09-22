"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseSpreadsheet, normalizeText, type SheetRow } from "@/lib/parse-spreadsheet";
import { errorMessage } from "@/lib/errors";

function guessHeader(headers: string[], candidates: string[]): string {
  const norm = headers.map(normalizeText);
  for (const c of candidates) {
    const idx = norm.findIndex((h) => h === normalizeText(c));
    if (idx >= 0) return headers[idx];
  }
  for (const c of candidates) {
    const idx = norm.findIndex((h) => h.includes(normalizeText(c)));
    if (idx >= 0) return headers[idx];
  }
  return "";
}

function SkuImport() {
  const r = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [nameCol, setNameCol] = useState("");
  const [skuCol, setSkuCol] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    updated: number;
    skipped: number;
    notFound: string[];
  } | null>(null);

  async function handleFile(f: File) {
    setError("");
    setResult(null);
    try {
      const { headers: h, rows: r } = await parseSpreadsheet(f);
      setHeaders(h);
      setRows(r);
      setNameCol(guessHeader(h, ["nome do produto", "product name"]));
      setSkuCol(guessHeader(h, ["sku principal do produto", "sku principal", "sku"]));
    } catch (e) {
      setError(errorMessage(e, "Não consegui ler esse arquivo."));
    }
  }

  async function submit() {
    if (!nameCol || !skuCol) return setError("Selecione as duas colunas antes de importar.");
    setBusy(true);
    setError("");
    try {
      // Só a primeira linha de cada produto importa (o relatório repete o
      // nome do produto uma vez por variação, mas o SKU principal é o mesmo).
      const seen = new Set<string>();
      const payload = [];
      for (const row of rows) {
        const name = String(row[nameCol] || "").trim();
        const sku = String(row[skuCol] || "").trim();
        if (!name || !sku || seen.has(name)) continue;
        seen.add(name);
        payload.push({ product_name: name, sku });
      }
      const res = await fetch("/api/products/import-sku", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: payload, overwrite }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Erro ao importar.");
      setResult(j);
      r.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="muted">
        Suba o modelo <strong>&quot;Informações básicas&quot;</strong> exportado em Editar em Massa → Baixar,
        na Shopee. Vou casar cada produto pelo nome e preencher o SKU no sistema.
      </p>
      {error && <div className="error">{error}</div>}
      <div className="field">
        <input
          ref={ref}
          className="input"
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </div>
      {headers.length > 0 && (
        <>
          <div className="form-grid">
            <div className="field">
              <label>Coluna com o nome do produto</label>
              <select
                className="select"
                value={nameCol}
                onChange={(e) => setNameCol(e.target.value)}
              >
                <option value="">Selecione</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Coluna com o SKU principal</label>
              <select className="select" value={skuCol} onChange={(e) => setSkuCol(e.target.value)}>
                <option value="">Selecione</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label className="check-row" style={{ margin: "8px 0" }}>
            <input
              type="checkbox"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
            />{" "}
            Substituir o SKU de produtos que já têm um cadastrado
          </label>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? "Importando..." : `Importar SKU (${rows.length} linhas na planilha)`}
          </button>
        </>
      )}
      {result && (
        <div style={{ marginTop: 12 }}>
          <p>
            ✅ <strong>{result.updated}</strong> produto(s) atualizados.
            {result.skipped > 0 && (
              <>
                {" "}
                <strong>{result.skipped}</strong> já tinham SKU e foram ignorados.
              </>
            )}
          </p>
          {result.notFound.length > 0 && (
            <>
              <p className="muted">Não encontrados/ignorados ({result.notFound.length}):</p>
              <ul>
                {result.notFound.map((n, i) => (
                  <li key={i} className="muted">
                    {n}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MediaImport() {
  const r = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [nameCol, setNameCol] = useState("");
  const [imageCols, setImageCols] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    productsUpdated: number;
    photosAdded: number;
    notFound: string[];
  } | null>(null);

  async function handleFile(f: File) {
    setError("");
    setResult(null);
    try {
      const { headers: h, rows: r } = await parseSpreadsheet(f);
      setHeaders(h);
      setRows(r);
      setNameCol(guessHeader(h, ["nome do produto", "product name"]));
      setImageCols(h.filter((x) => /imagem|foto|image/i.test(x)));
    } catch (e) {
      setError(errorMessage(e, "Não consegui ler esse arquivo."));
    }
  }

  function toggleImageCol(col: string) {
    setImageCols((cols) => (cols.includes(col) ? cols.filter((c) => c !== col) : [...cols, col]));
  }

  async function submit() {
    if (!nameCol) return setError("Selecione a coluna com o nome do produto.");
    if (!imageCols.length) return setError("Selecione pelo menos uma coluna de imagem.");
    setBusy(true);
    setError("");
    try {
      const payload = rows
        .map((row) => ({
          product_name: String(row[nameCol] || "").trim(),
          image_urls: imageCols
            .map((c) => String(row[c] || "").trim())
            .filter((u) => /^https?:\/\//.test(u)),
        }))
        .filter((r) => r.product_name && r.image_urls.length);
      const res = await fetch("/api/products/import-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: payload }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Erro ao importar.");
      setResult(j);
      r.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="muted">
        Suba o modelo <strong>&quot;Informações de Mídia&quot;</strong> exportado da Shopee. As fotos ficam
        linkadas direto do link da Shopee — não ocupam espaço no seu armazenamento.
      </p>
      {error && <div className="error">{error}</div>}
      <div className="field">
        <input
          ref={ref}
          className="input"
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </div>
      {headers.length > 0 && (
        <>
          <div className="field">
            <label>Coluna com o nome do produto</label>
            <select className="select" value={nameCol} onChange={(e) => setNameCol(e.target.value)}>
              <option value="">Selecione</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Colunas de imagem (marque quantas quiser, até 8 fotos por produto)</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {headers.map((h) => (
                <label key={h} className="check-row">
                  <input
                    type="checkbox"
                    checked={imageCols.includes(h)}
                    onChange={() => toggleImageCol(h)}
                  />{" "}
                  {h}
                </label>
              ))}
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={submit}
            disabled={busy}
            style={{ marginTop: 8 }}
          >
            {busy ? "Importando..." : `Importar fotos (${rows.length} linhas na planilha)`}
          </button>
        </>
      )}
      {result && (
        <div style={{ marginTop: 12 }}>
          <p>
            ✅ <strong>{result.photosAdded}</strong> foto(s) adicionadas em{" "}
            <strong>{result.productsUpdated}</strong> produto(s).
          </p>
          {result.notFound.length > 0 && (
            <>
              <p className="muted">Não encontrados/ignorados ({result.notFound.length}):</p>
              <ul>
                {result.notFound.map((n, i) => (
                  <li key={i} className="muted">
                    {n}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function CatalogImport() {
  const [tab, setTab] = useState<"sku" | "media">("sku");
  return (
    <div className="card">
      <div className="section-title">
        <h2>Importar catálogo da Shopee</h2>
      </div>
      <div className="page-tabs" role="tablist">
        <button
          type="button"
          className={`page-tab ${tab === "sku" ? "page-tab-active" : ""}`}
          onClick={() => setTab("sku")}
        >
          SKU
        </button>
        <button
          type="button"
          className={`page-tab ${tab === "media" ? "page-tab-active" : ""}`}
          onClick={() => setTab("media")}
        >
          Fotos
        </button>
      </div>
      <div className="page-tab-panel">{tab === "sku" ? <SkuImport /> : <MediaImport />}</div>
    </div>
  );
}
