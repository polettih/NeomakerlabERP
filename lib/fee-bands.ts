/**
 * Faixas de preço com taxa própria por canal de venda (ex.: Shopee, que
 * cobra percentuais e taxas fixas diferentes conforme o valor do item).
 * Compartilhado entre a API de canais (validação ao salvar) e a de pedidos
 * (escolha automática da faixa certa pelo valor da venda).
 */

export type FeeBand = {
  min: number;
  max: number | null;
  fee_percent: number;
  fixed_fee: number;
};

/** Valida e normaliza faixas vindas do cliente: descarta linhas inválidas,
 * ordena por "min" crescente. Nunca lança — na dúvida, ignora a faixa. */
export function sanitizeFeeBands(input: unknown): FeeBand[] {
  if (!Array.isArray(input)) return [];
  const bands: FeeBand[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const min = Number(r.min);
    if (!Number.isFinite(min) || min < 0) continue;
    const max = r.max === null || r.max === undefined || r.max === "" ? null : Number(r.max);
    if (max !== null && (!Number.isFinite(max) || max < min)) continue;
    const feePercent = Math.max(0, Math.min(1, Number(r.fee_percent) || 0));
    const fixedFee = Math.max(0, Number(r.fixed_fee) || 0);
    bands.push({ min, max, fee_percent: feePercent, fixed_fee: fixedFee });
  }
  return bands.sort((a, b) => a.min - b.min);
}

/** Escolhe a faixa cujo intervalo [min, max] contém `amount`. Se o valor for
 * menor que a menor faixa ou maior que a maior (sem teto ausente), usa a
 * faixa mais próxima em vez de deixar o pedido sem taxa nenhuma. */
export function resolveFeeBand(bands: FeeBand[], amount: number): FeeBand | null {
  if (!bands.length) return null;
  const sorted = bands.slice().sort((a, b) => a.min - b.min);
  const match = sorted.find((b) => amount >= b.min && (b.max === null || amount <= b.max));
  if (match) return match;
  return amount < sorted[0].min ? sorted[0] : sorted[sorted.length - 1];
}
