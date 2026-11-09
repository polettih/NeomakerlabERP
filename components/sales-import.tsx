"use client";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { errorMessage } from "@/lib/errors";
import { parseSpreadsheet } from "@/lib/parse-spreadsheet";

type VariantLite = { id: string; name: string; sku: string | null };
type Product = { id: string; name: string; sku: string | null; variants?: VariantLite[] };
type Channel = { id: string; name: string; active: boolean };

const FIELD_DEFS = [
  { key: "order_number", label: "Nº do pedido", required: false },
  { key: "order_date", label: "Data do pedido", required: false },
  { key: "status", label: "Status do pedido", required: true },
  { key: "sku", label: "SKU", required: false },
  { key: "variation_sku", label: "SKU da variação (opcional)", required: false },
  { key: "variation_name", label: "Nome da variação (opcional)", required: false },
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
    "sku pai",
    "sku do produto",
    "sku",
  ],
  variation_sku: [
    "número de referência sku",
    "numero de referencia sku",
    "sku de referência",
    "sku de referencia",
    "sku da variação",
    "sku da variacao",
  ],
  variation_name: [
    "nome da variação",
    "nome da variacao",
    "variação",
    "variacao",
    "variation name",
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
  // Textos de outras plataformas (Mercado Livre: "Pacote cancelado", "Entregue"...; TikTok
  // Shop: "Awaiting shipment", "In transit", "Completed"...).
  if (/cancel/.test(n)) return { status: "cancelled", known: true };
  if (/entreg|deliver|conclu|complet/.test(n)) return { status: "delivered", known: true };
  if (/a caminho|enviado|shipped|in transit|transito|retirada/.test(n))
    return { status: "shipped", known: true };
  if (/prepar|pronto|awaiting|processando|pago|paid|pendente|a enviar|para enviar|on hold/.test(n))
    return { status: "new", known: true };
  return { status: "new", known: false };
}
const STATUS_LABEL: Record<string, string> = {
  cancelled: "Cancelado",
  new: "A enviar",
  shipped: "Enviado",
  delivered: "Entregue",
};

// ---- Plataformas ---------------------------------------------------------------------------
// A plataforma é detectada sozinha pelas colunas do arquivo (o usuário não escolhe). Cada uma
// define: como achar o canal cadastrado, colunas próprias, colunas de taxa real (quando a
// planilha traz) e o sinal da taxa. Sem colunas de taxa (TikTok Shop), o sistema usa a taxa
// e as faixas cadastradas no canal em Configurações.
type PlatformKey = "shopee" | "mercadolivre" | "tiktok";
type Platform = {
  key: PlatformKey;
  label: string;
  channelMatch: string;
  detect: (norm: string[]) => boolean;
  guesses: Partial<Record<FieldKey, string[]>>;
  feeColumns: string[];
};
const PLATFORMS: Platform[] = [
  {
    key: "shopee",
    label: "Shopee",
    channelMatch: "shopee",
    detect: (h) =>
      h.includes("id do pedido") || h.some((x) => x.includes("taxa de comissao liquida")),
    guesses: {},
    feeColumns: FEE_COLUMN_GUESSES,
  },
  {
    key: "mercadolivre",
    label: "Mercado Livre",
    channelMatch: "mercado",
    detect: (h) =>
      h.some((x) =>
        ["n.o de venda", "n.º de venda", "nº de venda", "n° de venda", "# de anuncio"].some((k) =>
          x.startsWith(k)
        )
      ) || h.some((x) => x.startsWith("tarifa de venda")),
    guesses: {
      order_number: ["n.º de venda", "nº de venda", "n° de venda", "numero de venda"],
      order_date: ["data da venda"],
      status: ["descrição do status", "descricao do status", "estado"],
      sku: ["sku"],
      variation_name: ["variação", "variacao"],
      product_name: ["título do anúncio", "titulo do anuncio"],
      quantity: ["unidades"],
      item_total: ["receita por produtos (brl)", "receita por produtos"],
      shipping: ["tarifas de envio (brl)", "tarifas de envio", "custo de envio"],
    },
    feeColumns: ["tarifa de venda e impostos (brl)", "tarifa de venda e impostos"],
  },
  {
    key: "tiktok",
    label: "TikTok Shop",
    channelMatch: "tiktok",
    detect: (h) =>
      h.includes("order id") &&
      (h.includes("seller sku") || h.includes("sku id") || h.includes("variation")),
    guesses: {
      order_number: ["order id"],
      order_date: ["created time", "paid time"],
      status: ["order status"],
      sku: ["seller sku"],
      variation_name: ["variation"],
      product_name: ["product name"],
      quantity: ["quantity"],
      item_total: ["sku subtotal after discount", "sku subtotal before discount"],
      shipping: ["shipping fee after discount", "original shipping fee"],
    },
    feeColumns: [],
  },
];
function detectPlatform(headers: string[]): Platform {
  const norm = headers.map((h) =>
    h
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
  );
  // Ordem: Mercado Livre e TikTok têm colunas exclusivas; a Shopee é o padrão.
  return (
    PLATFORMS.find((p) => p.key !== "shopee" && p.detect(norm)) ??
    PLATFORMS.find((p) => p.key === "shopee")!
  );
}

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
  variant_id: string | null;
  variation_name: string;
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
    variation_sku: "",
    variation_name: "",
    product_name: "",
    quantity: "",
    item_total: "",
    shipping: "",
  });
  const [feeColumns, setFeeColumns] = useState<string[]>([]);
  const [platform, setPlatform] = useState<Platform>(PLATFORMS[0]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    duplicates: number;
    errors: { external_order_id: string | null; reason: string }[];
  } | null>(null);
  const [manualPick, setManualPick] = useState<Record<number, string>>({});
  const [manualVariant, setManualVariant] = useState<Record<number, string>>({});

  // A plataforma é detectada pelas colunas do arquivo e o canal é achado sozinho pelo nome
  // cadastrado em Configurações — o usuário não escolhe nada aqui. A escolha manual de
  // plataforma continua só no lançamento de pedido avulso.
  const channel = channels.find((c) => normalize(c.name).includes(platform.channelMatch));

  async function handleFile(f: File) {
    setError("");
    try {
      const { headers: hdrs, rows } = await parseSpreadsheet(f);
      setHeaders(hdrs);
      setRawRows(rows);
      const plat = detectPlatform(hdrs);
      setPlatform(plat);
      const guessed = {} as Record<FieldKey, string>;
      for (const fd of FIELD_DEFS)
        guessed[fd.key] = guessColumn(hdrs, [...(plat.guesses[fd.key] ?? []), ...GUESSES[fd.key]]);
      setMapping(guessed);
      const guessedFeeCols = hdrs.filter((h) =>
        plat.feeColumns.some((g) => normalize(h) === normalize(g))
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
      const shipping = mapping.shipping ? Math.abs(parseMoney(row[mapping.shipping])) : 0;
      // Algumas plataformas (Mercado Livre) trazem a tarifa como valor negativo: usa o módulo.
      const realFee = feeColumns.reduce((s, c) => s + Math.abs(parseMoney(row[c])), 0);
      const orderNumber = mapping.order_number
        ? String(row[mapping.order_number] ?? "").trim()
        : "";
      const orderDateRaw = mapping.order_date ? String(row[mapping.order_date] ?? "").trim() : "";
      const statusRaw = String(row[mapping.status] ?? "").trim();
      const { status, known } = mapStatus(statusRaw);
      const variationSku = mapping.variation_sku
        ? String(row[mapping.variation_sku] ?? "").trim()
        : "";
      const variationName = mapping.variation_name
        ? String(row[mapping.variation_name] ?? "").trim()
        : "";
      let productId: string | null = manualPick[idx] || null;
      let variantId: string | null = null;
      // 1) SKU principal do produto, 2) SKU da variação (identifica produto + variação),
      // 3) nome do produto.
      if (!productId && sku) {
        const bySku = products.find((p) => p.sku && normalize(p.sku) === normalize(sku));
        if (bySku) productId = bySku.id;
      }
      if (!productId && variationSku) {
        const owner = products.find((p) =>
          (p.variants ?? []).some((v) => v.sku && normalize(v.sku) === normalize(variationSku))
        );
        if (owner) productId = owner.id;
      }
      if (!productId && productName) {
        const byName = products.find((p) => normalize(p.name) === normalize(productName));
        if (byName) productId = byName.id;
      }
      const prod = products.find((p) => p.id === productId);
      const pvs = prod?.variants ?? [];
      if (pvs.length) {
        const nv = normalize(variationName);
        const found =
          (manualVariant[idx] && pvs.find((v) => v.id === manualVariant[idx])) ||
          (variationSku &&
            pvs.find((v) => v.sku && normalize(v.sku) === normalize(variationSku))) ||
          (nv && pvs.find((v) => normalize(v.name) === nv)) ||
          (nv &&
            pvs.find(
              (v) => normalize(v.name).startsWith(nv) || nv.startsWith(normalize(v.name))
            )) ||
          (nv && pvs.find((v) => normalize(v.name).includes(nv) || nv.includes(normalize(v.name))));
        if (found) variantId = found.id;
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
        variant_id: variantId,
        variation_name: variationName,
      };
    });
  }, [rawRows, mapping, feeColumns, products, manualPick, manualVariant, step]);

  const unmatchedCount = matched.filter((m) => !m.product_id).length;
  const missingVariantCount = matched.filter(
    (m) =>
      m.product_id &&
      !m.variant_id &&
      (products.find((p) => p.id === m.product_id)?.variants?.length ?? 0) > 0
  ).length;
  const unknownStatusCount = matched.filter((m) => !m.statusKnown).length;
  const missingRequired = FIELD_DEFS.filter((f) => f.required && !mapping[f.key]);

  function goPreview() {
    if (!channel) {
      setError(
        `Não achei um canal de venda chamado "${platform.label}" em Configurações. Crie um antes de importar, pra taxa ficar correta.`
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
          items: {
            product_id: string;
            variant_id: string | null;
            quantity: number;
            unit_price: number;
          }[];
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
        g.items.push({
          product_id: m.product_id,
          variant_id: m.variant_id,
          quantity: m.quantity,
          unit_price: unitPrice,
        });
      });
      const res = await fetch("/api/orders/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sales_channel_id: channel!.id,
          // Com colunas de taxa na planilha usa o valor real de cada pedido; sem elas (TikTok
          // Shop) a API calcula pela taxa/faixas cadastradas no canal.
          use_real_fee: feeColumns.length > 0,
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
    setManualVariant({});
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
            Suba o relatório de pedidos da Shopee, do Mercado Livre ou do TikTok Shop (.xlsx ou
            .csv) — o sistema reconhece a plataforma, casa as linhas com seus produtos e variações e
            usa o status que já está na planilha, sem precisar escolher nada.
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
            <label>
              Colunas de taxa real a somar (ajuste se a plataforma mudar os nomes
              {platform.feeColumns.length === 0 ? "; nenhuma marcada = usa a taxa do canal" : ""})
            </label>
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
            Plataforma detectada: <strong>{platform.label}</strong> · Canal:{" "}
            <strong>{channel ? channel.name : `${platform.label} não encontrado`}</strong> —{" "}
            {feeColumns.length
              ? "a taxa usada é a soma das colunas marcadas acima (o valor real cobrado em cada pedido)."
              : "a planilha não traz a taxa, então vale a taxa e as faixas cadastradas nesse canal em Configurações."}{" "}
            O status de cada pedido é lido direto da planilha.
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
            {missingVariantCount > 0 && (
              <span style={{ color: "#f87171" }}>
                {" "}
                — {missingVariantCount} linha(s) de produto com variações sem variação identificada
                (escolha na coluna Variação; sem escolha, entram sem variação)
              </span>
            )}
            {unknownStatusCount > 0 && (
              <span style={{ color: "#f87171" }}>
                {" "}
                — {unknownStatusCount} com status não reconhecido (tratadas como &quot;A
                enviar&quot;)
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
                  <th>Variação</th>
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
                    <td>
                      {(() => {
                        const pvs = products.find((p) => p.id === m.product_id)?.variants ?? [];
                        if (!m.product_id || !pvs.length)
                          return <span className="muted">{m.variation_name || "—"}</span>;
                        return (
                          <select
                            className="select"
                            value={m.variant_id || ""}
                            onChange={(e) =>
                              setManualVariant((mv) => ({ ...mv, [idx]: e.target.value }))
                            }
                          >
                            <option value="">
                              {m.variation_name
                                ? `${m.variation_name} — escolher...`
                                : "Escolher..."}
                            </option>
                            {pvs.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.name}
                              </option>
                            ))}
                          </select>
                        );
                      })()}
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
