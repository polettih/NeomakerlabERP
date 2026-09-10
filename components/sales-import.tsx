"use client";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { errorMessage } from "@/lib/errors";

type Product = { id: string; name: string; sku: string | null };
type Channel = { id: string; name: string; active: boolean };

const FIELD_DEFS = [
  { key: "order_number", label: "Nº do pedido", required: false },
  { key: "order_date", label: "Data do pedido", required: false },
  { key: "sku", label: "SKU", required: false },
  { key: "product_name", label: "Nome do produto", required: true },
  { key: "quantity", label: "Quantidade", required: true },
  {
    key: "item_total",
    label: "Valor pago por esta linha (o que está na Shopee/TikTok)",
    required: true,
  },
  { key: "shipping", label: "Frete (opcional)", required: false },
] as const;
type FieldKey = (typeof FIELD_DEFS)[number]["key"];

const GUESSES: Record<FieldKey, string[]> = {
  order_number: [
    "número do pedido",
    "numero do pedido",
    "id do pedido",
    "order id",
    "order number",
  ],
  order_date: [
    "data de criação do pedido",
    "data de criacao do pedido",
    "data do pedido",
    "order date",
  ],
  sku: [
    "número de referência sku",
    "numero de referencia sku",
    "nº de referência sku",
    "sku de referência",
    "sku de referencia",
    "sku pai",
    "sku do produto",
    "sku",
  ],
  product_name: ["nome do produto", "product name", "produto"],
  quantity: ["quantidade", "qtd", "quantity"],
  // "Subtotal do produto" é o valor da linha inteira (preço × quantidade) — é isso que
  // este campo precisa (o código divide por quantidade depois para achar o valor
  // unitário). "Preço acordado"/"Preço original" são valores POR UNIDADE e vêm antes
  // dele na planilha real da Shopee, então precisam ficar depois na lista de tentativas
  // para não serem escolhidos por engano (senão o valor importado fica dividido pela
  // quantidade duas vezes).
  item_total: [
    "subtotal do produto",
    "total do produto",
    "valor total do pedido",
    "item subtotal",
    "total settlement amount",
    "preço acordado",
    "preco acordado",
  ],
  shipping: ["frete", "taxa de envio", "shipping fee"],
};

// Relatórios brasileiros (Shopee, TikTok Shop) exportam datas como "DD/MM/AAAA HH:mm",
// que o `new Date(...)` nativo do JS interpreta errado (ou quebra): ele lê como
// MM/DD, então "10/01/2026" vira 1º de outubro em vez de 10 de janeiro, e datas com
// dia > 12 (ex.: "25/01/2026") derrubam com "Invalid time value". Por isso nunca
// confiamos no parser nativo para essas strings.
function parseBrazilianDate(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const m = trimmed.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (m) {
    const [, d, mo, y, h = "0", mi = "0", s = "0"] = m;
    const dt = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  // Fallback: já pode vir em ISO (planilha com célula de data real, não texto).
  const fallback = new Date(trimmed);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function guessColumn(headers: string[], field: FieldKey): string {
  const normHeaders = headers.map(normalize);
  for (const guess of GUESSES[field]) {
    const idx = normHeaders.findIndex((h) => h === normalize(guess));
    if (idx >= 0) return headers[idx];
  }
  for (const guess of GUESSES[field]) {
    const g = normalize(guess);
    // Bidirecional: pega tanto "sku" dentro de "número de referência sku" quanto o
    // inverso, porque a ordem das palavras muda de exportação pra exportação.
    const idx = normHeaders.findIndex((h) => h.includes(g) || g.includes(h));
    if (idx >= 0) return headers[idx];
  }
  return "";
}

type ParsedRow = Record<string, string>;
type MatchedRow = {
  order_number: string;
  order_date: string;
  product_name: string;
  quantity: number;
  item_total: number;
  shipping: number;
  product_id: string | null;
};

export function SalesImport({ products, channels }: { products: Product[]; channels: Channel[] }) {
  const r = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "map" | "preview" | "done">("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, string>>({
    order_number: "",
    order_date: "",
    sku: "",
    product_name: "",
    quantity: "",
    item_total: "",
    shipping: "",
  });
  const [channelId, setChannelId] = useState(channels.find((c) => c.active)?.id || "");
  const [markAsDelivered, setMarkAsDelivered] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    duplicates: number;
    errors: { external_order_id: string | null; reason: string }[];
  } | null>(null);
  const [manualPick, setManualPick] = useState<Record<number, string>>({});

  async function handleFile(f: File) {
    setError("");
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<ParsedRow>(sheet, { defval: "" });
      if (!rows.length) throw new Error("A planilha está vazia ou não pôde ser lida.");
      const hdrs = Object.keys(rows[0]);
      setHeaders(hdrs);
      setRawRows(rows);
      const guessed = {} as Record<FieldKey, string>;
      for (const fd of FIELD_DEFS) guessed[fd.key] = guessColumn(hdrs, fd.key);
      setMapping(guessed);
      setStep("map");
    } catch (e) {
      setError(errorMessage(e, "Não consegui ler esse arquivo. Confira se é um .csv ou .xlsx."));
    }
  }

  const matched = useMemo<MatchedRow[]>(() => {
    if (step !== "preview" && step !== "done") return [];
    return rawRows.map((row, idx) => {
      const productName = String(row[mapping.product_name] ?? "").trim();
      const sku = mapping.sku ? String(row[mapping.sku] ?? "").trim() : "";
      const qty = Math.max(Number(row[mapping.quantity]) || 1, 1);
      const total =
        Number(
          String(row[mapping.item_total])
            .replace(/[^\d.,-]/g, "")
            .replace(",", ".")
        ) || 0;
      const shipping = mapping.shipping
        ? Number(
            String(row[mapping.shipping])
              .replace(/[^\d.,-]/g, "")
              .replace(",", ".")
          ) || 0
        : 0;
      const orderNumber = mapping.order_number
        ? String(row[mapping.order_number] ?? "").trim()
        : "";
      const orderDateRaw = mapping.order_date ? String(row[mapping.order_date] ?? "").trim() : "";
      let productId: string | null = manualPick[idx] || null;
      if (!productId && sku) {
        const bySku = products.find((p) => p.sku && normalize(p.sku) === normalize(sku));
        if (bySku) productId = bySku.id;
      }
      if (!productId && productName) {
        const byName = products.find((p) => normalize(p.name) === normalize(productName));
        if (byName) productId = byName.id;
      }
      return {
        order_number: orderNumber,
        order_date: orderDateRaw,
        product_name: productName,
        quantity: qty,
        item_total: total,
        shipping,
        product_id: productId,
      };
    });
  }, [rawRows, mapping, products, manualPick, step]);

  const unmatchedCount = matched.filter((m) => !m.product_id).length;
  const missingRequired = FIELD_DEFS.filter((f) => f.required && !mapping[f.key]);

  function goPreview() {
    if (missingRequired.length) {
      setError(`Selecione a coluna de: ${missingRequired.map((f) => f.label).join(", ")}.`);
      return;
    }
    setError("");
    setStep("preview");
  }

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const groups = new Map<
        string,
        {
          external_order_id: string | null;
          order_date: string | null;
          shipping_cost: number;
          items: { product_id: string; quantity: number; unit_price: number }[];
        }
      >();
      matched.forEach((m) => {
        if (!m.product_id) return;
        const key = m.order_number || `__row_${groups.size}_${Math.random()}`;
        const unitPrice = m.item_total / m.quantity;
        if (!groups.has(key)) {
          const parsed = m.order_date ? parseBrazilianDate(m.order_date) : null;
          groups.set(key, {
            external_order_id: m.order_number || null,
            order_date: parsed ? parsed.toISOString() : null,
            shipping_cost: 0,
            items: [],
          });
        }
        const g = groups.get(key)!;
        g.shipping_cost += m.shipping;
        g.items.push({ product_id: m.product_id, quantity: m.quantity, unit_price: unitPrice });
      });
      const res = await fetch("/api/orders/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sales_channel_id: channelId || null,
          fee_mode: "subtract",
          mark_as_delivered: markAsDelivered,
          orders: [...groups.values()],
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Erro ao importar.");
      setResult(j);
      setStep("done");
      r.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setStep("upload");
    setHeaders([]);
    setRawRows([]);
    setManualPick({});
    setResult(null);
    setError("");
    if (ref.current) ref.current.value = "";
  }

  return (
    <div className="card">
      <div className="section-title">
        <div>
          <h2>Importar vendas</h2>
          <p className="muted">
            Suba o relatório de pedidos exportado da Shopee ou do TikTok Shop (.xlsx ou .csv) — o
            sistema lê as linhas, casa com seus produtos cadastrados e cria os pedidos.
          </p>
        </div>
        {step !== "upload" && (
          <button className="btn btn-secondary btn-sm" onClick={reset}>
            Recomeçar
          </button>
        )}
      </div>
      {error && <div className="error">{error}</div>}

      {step === "upload" && (
        <div className="field">
          <label>Arquivo do relatório</label>
          <input
            ref={ref}
            className="input"
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>
      )}

      {step === "map" && (
        <>
          <p className="muted">
            Confira se cada campo abaixo apontou pra coluna certa da sua planilha (achei sozinho o
            que deu, mas confira antes de continuar).
          </p>
          <div className="form-grid">
            {FIELD_DEFS.map((f) => (
              <div className="field" key={f.key}>
                <label>
                  {f.label} {f.required && <span className="muted">(obrigatório)</span>}
                </label>
                <select
                  className="select"
                  value={mapping[f.key]}
                  onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                >
                  <option value="">— não usar —</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <div className="field">
              <label>Canal de venda</label>
              <select
                className="select"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
              >
                <option value="">Nenhum (sem taxa de marketplace)</option>
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Status dos pedidos importados</label>
              <select
                className="select"
                value={markAsDelivered ? "delivered" : "new"}
                onChange={(e) => setMarkAsDelivered(e.target.value === "delivered")}
              >
                <option value="delivered">
                  Já entregues e pagos (relatório de vendas passadas)
                </option>
                <option value="new">Novos, ainda em aberto</option>
              </select>
            </div>
          </div>
          <p className="muted">
            O valor de cada linha é tratado como o preço que aparece no anúncio (a taxa do canal é
            descontada dele, não somada) — igual ao lançamento manual de pedido.
          </p>
          <button className="btn btn-primary" onClick={goPreview}>
            Ver prévia ({rawRows.length} linhas)
          </button>
        </>
      )}

      {step === "preview" && (
        <>
          <p className="muted">
            {matched.length} linhas lidas
            {unmatchedCount > 0 && (
              <span style={{ color: "#f87171" }}>
                {" "}
                — {unmatchedCount} sem produto encontrado (escolha manualmente ou elas serão
                ignoradas)
              </span>
            )}
            .
          </p>
          <div style={{ maxHeight: 420, overflow: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Produto na planilha</th>
                  <th>Produto no sistema</th>
                  <th>Qtd</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {matched.map((m, idx) => (
                  <tr
                    key={idx}
                    style={!m.product_id ? { background: "rgba(248,113,113,0.08)" } : {}}
                  >
                    <td>{m.order_number || "—"}</td>
                    <td>{m.product_name}</td>
                    <td>
                      {m.product_id ? (
                        products.find((p) => p.id === m.product_id)?.name
                      ) : (
                        <select
                          className="select"
                          value={manualPick[idx] || ""}
                          onChange={(e) =>
                            setManualPick((mp) => ({ ...mp, [idx]: e.target.value }))
                          }
                        >
                          <option value="">Não encontrado — escolher...</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td>{m.quantity}</td>
                    <td>
                      {m.item_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            className="btn btn-primary"
            onClick={submit}
            disabled={busy}
            style={{ marginTop: 12 }}
          >
            {busy
              ? "Importando..."
              : `Importar ${matched.filter((m) => m.product_id).length} linhas`}
          </button>
        </>
      )}

      {step === "done" && result && (
        <div>
          <p>
            ✅ <strong>{result.created}</strong> pedido(s) importado(s).
            {result.duplicates > 0 && (
              <>
                {" "}
                <strong>{result.duplicates}</strong> já existiam e foram ignorados.
              </>
            )}
          </p>
          {result.errors.length > 0 && (
            <>
              <p className="muted">{result.errors.length} pedido(s) não puderam ser importados:</p>
              <ul>
                {result.errors.map((e, i) => (
                  <li key={i} className="muted">
                    {e.external_order_id || "(sem número)"}: {e.reason}
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
