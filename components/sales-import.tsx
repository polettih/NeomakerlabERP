"use client";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { errorMessage } from "@/lib/errors";
import { parseSpreadsheet } from "@/lib/parse-spreadsheet";

type Product = { id: string; name: string; sku: string | null };
type Channel = { id: string; name: string; active: boolean };

const FIELD_DEFS = [
  { key: "order_number", label: "Nº do pedido", required: false },
  { key: "order_date", label: "Data do pedido", required: false },
  { key: "status", label: "Status do pedido", required: true },
  { key: "sku", label: "SKU", required: false },
  { key: "product_name", label: "Nome do produto", required: true },
  { key: "quantity", label: "Quantidade", required: true },
  { key: "item_total", label: "Valor da linha (Subtotal do produto)", required: true },
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
  status: ["status do pedido", "order status", "status"],
  sku: [
    "nº de referência do sku principal",
    "no de referência do sku principal",
    "sku principal",
    "sku de referência",
    "sku de referencia",
    "sku pai",
    "número de referência sku",
    "numero de referencia sku",
    "sku do produto",
    "sku",
  ],
  product_name: ["nome do produto", "product name", "produto"],
  quantity: ["quantidade", "qtd", "quantity"],
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

// Colunas de taxa que a Shopee já calcula pedido a pedido — usar o valor real
// delas é mais preciso do que recalcular por uma taxa fixa ou por faixa de
// preço configurada manualmente, porque reflete exatamente o que a Shopee
// cobrou NAQUELE pedido (campanhas, nível do vendedor, etc. já aplicados).
const FEE_COLUMN_GUESSES = [
  "taxa de comissão líquida",
  "taxa de serviço líquida",
  "taxa de transação",
];

// A Shopee usa vários textos de status — mapeamento direto pro status interno
// do sistema, sem o usuário escolher nada na importação.
const STATUS_MAP: Record<string, string> = {
  cancelado: "cancelled",
  "a enviar": "new",
  "para enviar": "new",
  processando: "new",
  enviado: "shipped",
  entregue: "delivered",
  concluido: "delivered",
};
function mapStatus(raw: string): { status: string; known: boolean } {
  const n = normalize(raw);
  if (STATUS_MAP[n]) return { status: STATUS_MAP[n], known: true };
  return { status: "new", known: false };
}
const STATUS_LABEL: Record<string, string> = {
  cancelled: "Cancelado",
  new: "A enviar",
  shipped: "Enviado",
  delivered: "Entregue",
};

// Relatórios brasileiros (Shopee, TikTok Shop) exportam datas como "DD/MM/AAAA HH:mm",
// que o `new Date(...)` nativo do JS interpreta errado (ou quebra): ele lê como
// MM/DD, então "10/01/2026" vira 1º de outubro em vez de 10 de janeiro, e datas com
// dia > 12 (ex.: "25/01/2026") derrubam com "Invalid time value". Por isso nunca
// confiamos no parser nativo para essas strings.
function parseBrazilianDate(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const [, d, mo, y, h = "0", mi = "0", s = "0"] = m;
    const dt = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
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

function parseMoney(raw: string) {
  return (
    Number(
      String(raw ?? "")
        .replace(/[^\d.,-]/g, "")
        .replace(",", ".")
    ) || 0
  );
}

function guessColumn(headers: string[], candidates: string[]): string {
  const normHeaders = headers.map(normalize);
  for (const guess of candidates) {
    const idx = normHeaders.findIndex((h) => h === normalize(guess));
    if (idx >= 0) return headers[idx];
  }
  for (const guess of candidates) {
    const g = normalize(guess);
    const idx = normHeaders.findIndex((h) => h.includes(g) || g.includes(h));
    if (idx >= 0) return headers[idx];
  }
  return "";
}

type ParsedRow = Record<string, string>;
type MatchedRow = {
  order_number: string;
  order_date: string;
  statusRaw: string;
  status: string;
  statusKnown: boolean;
  product_name: string;
  quantity: number;
  item_total: number;
  shipping: number;
  real_fee: number;
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
    status: "",
    sku: "",
    product_name: "",
    quantity: "",
    item_total: "",
    shipping: "",
  });
  const [feeColumns, setFeeColumns] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    duplicates: number;
    errors: { external_order_id: string | null; reason: string }[];
  } | null>(null);
  const [manualPick, setManualPick] = useState<Record<number, string>>({});

  // A importação é só para Shopee por enquanto — o canal é achado sozinho pelo
  // nome cadastrado em Configurações, sem o usuário escolher nada aqui. A
  // escolha de plataforma continua manual apenas no lançamento de pedido avulso.
  const shopeeChannel = channels.find((c) => normalize(c.name).includes("shopee"));

  async function handleFile(f: File) {
    setError("");
    try {
      const { headers: hdrs, rows } = await parseSpreadsheet(f);
      setHeaders(hdrs);
      setRawRows(rows);
      const guessed = {} as Record<FieldKey, string>;
      for (const fd of FIELD_DEFS) guessed[fd.key] = guessColumn(hdrs, GUESSES[fd.key]);
      setMapping(guessed);
      const guessedFeeCols = hdrs.filter((h) =>
        FEE_COLUMN_GUESSES.some((g) => normalize(h) === normalize(g))
      );
      setFeeColumns(guessedFeeCols);
      setStep("map");
    } catch (e) {
      setError(errorMessage(e, "Não consegui ler esse arquivo. Confira se é um .csv ou .xlsx."));
    }
  }

  function toggleFeeColumn(col: string) {
    setFeeColumns((cols) => (cols.includes(col) ? cols.filter((c) => c !== col) : [...cols, col]));
  }

  const matched = useMemo<MatchedRow[]>(() => {
    if (step !== "preview" && step !== "done") return [];
    return rawRows.map((row, idx) => {
      const productName = String(row[mapping.product_name] ?? "").trim();
      const sku = mapping.sku ? String(row[mapping.sku] ?? "").trim() : "";
      const qty = Math.max(Number(row[mapping.quantity]) || 1, 1);
      const total = parseMoney(row[mapping.item_total]);
      const shipping = mapping.shipping ? parseMoney(row[mapping.shipping]) : 0;
      const realFee = feeColumns.reduce((s, c) => s + parseMoney(row[c]), 0);
      const orderNumber = mapping.order_number
        ? String(row[mapping.order_number] ?? "").trim()
        : "";
      const orderDateRaw = mapping.order_date ? String(row[mapping.order_date] ?? "").trim() : "";
      const statusRaw = String(row[mapping.status] ?? "").trim();
      const { status, known } = mapStatus(statusRaw);
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
        statusRaw,
        status,
        statusKnown: known,
        product_name: productName,
        quantity: qty,
        item_total: total,
        shipping,
        real_fee: realFee,
        product_id: productId,
      };
    });
  }, [rawRows, mapping, feeColumns, products, manualPick, step]);

  const unmatchedCount = matched.filter((m) => !m.product_id).length;
  const unknownStatusCount = matched.filter((m) => !m.statusKnown).length;
  const missingRequired = FIELD_DEFS.filter((f) => f.required && !mapping[f.key]);

  function goPreview() {
    if (!shopeeChannel) {
      setError(
        'Não achei um canal de venda chamado "Shopee" em Configurações. Crie um antes de importar, pra taxa ficar correta.'
      );
      return;
    }
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
          status: string;
          shipping_cost: number;
          real_fee: number;
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
            status: m.status,
            shipping_cost: 0,
            real_fee: 0,
            items: [],
          });
        }
        const g = groups.get(key)!;
        g.shipping_cost += m.shipping;
        g.real_fee += m.real_fee;
        g.items.push({ product_id: m.product_id, quantity: m.quantity, unit_price: unitPrice });
      });
      const res = await fetch("/api/orders/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sales_channel_id: shopeeChannel!.id,
          use_real_fee: true,
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
          <h2>Importar vendas da Shopee</h2>
          <p className="muted">
            Suba o relatório de pedidos exportado da Shopee (.xlsx ou .csv) — o sistema lê as
            linhas, casa com seus produtos, usa a taxa real de cada pedido e o status que já está na
            planilha, sem precisar escolher nada.
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
          </div>
          <div className="field">
            <label>Colunas de taxa real a somar (ajuste se a Shopee mudar os nomes)</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {headers
                .filter((h) => normalize(h).includes("taxa") || normalize(h).includes("comiss"))
                .map((h) => (
                  <label key={h} className="check-row">
                    <input
                      type="checkbox"
                      checked={feeColumns.includes(h)}
                      onChange={() => toggleFeeColumn(h)}
                    />{" "}
                    {h}
                  </label>
                ))}
            </div>
          </div>
          <p className="muted">
            Canal: <strong>{shopeeChannel ? shopeeChannel.name : "Shopee não encontrada"}</strong> —
            a taxa usada é a soma das colunas marcadas acima (o valor real da Shopee pra cada
            pedido), não uma taxa fixa configurada no sistema. O status de cada pedido é lido direto
            da planilha.
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
            {unknownStatusCount > 0 && (
              <span style={{ color: "#f87171" }}>
                {" "}
                — {unknownStatusCount} com status não reconhecido (tratadas como &quot;A enviar&quot;)
              </span>
            )}
            .
          </p>
          <div style={{ maxHeight: 420, overflow: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Status</th>
                  <th>Produto na planilha</th>
                  <th>Produto no sistema</th>
                  <th>Qtd</th>
                  <th>Valor</th>
                  <th>Taxa real</th>
                </tr>
              </thead>
              <tbody>
                {matched.map((m, idx) => (
                  <tr
                    key={idx}
                    style={!m.product_id ? { background: "rgba(248,113,113,0.08)" } : {}}
                  >
                    <td>{m.order_number || "—"}</td>
                    <td>
                      {STATUS_LABEL[m.status]}
                      {!m.statusKnown && (
                        <span className="muted"> ({m.statusRaw || "vazio"}?)</span>
                      )}
                    </td>
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
                    <td>
                      {m.real_fee.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
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
