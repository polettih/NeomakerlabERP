/**
 * Formatação compartilhada de moeda, data e status. Centralizado aqui para
 * evitar reimplementações divergentes espalhadas pelo projeto.
 */

export const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Mesma formatação de `money`, mas com "R$ - " explícito para valores negativos
 * (útil em colunas de saldo/dívida onde o sinal precisa ficar bem visível). */
export const signedMoney = (value: number) => {
  const abs = Math.abs(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return value < 0 ? `R$ - ${abs.replace(/^R\$\s?/, "")}` : abs;
};

export const compactMoney = (value: number) => {
  const a = Math.abs(value);
  if (a >= 1e6) return `R$ ${(a / 1e6).toFixed(1)} mi`;
  if (a >= 1e3) return `R$ ${(a / 1e3).toFixed(1)} mil`;
  return `R$ ${Math.round(a)}`;
};

export const n = (v: unknown): number => {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
};

export const validDate = (v: unknown): Date | null => {
  const d = new Date(String(v ?? ""));
  return Number.isNaN(d.getTime()) ? null : d;
};

export const monthKey = (v: unknown): string | null => {
  const d = validDate(v);
  return d ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}` : null;
};

export const monthLabel = (key: string): string => {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, 1)))
    .replace(" de ", "/")
    .replace(".", "");
};

export const formatDate = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "-";

const PAID_STATUSES = new Set(["paid", "pago", "paid_out"]);
const CANCELLED_STATUSES = new Set(["cancelled", "canceled", "cancelado"]);

export const isPaidStatus = (status: unknown) => PAID_STATUSES.has(String(status ?? "").toLowerCase());
export const isCancelledStatus = (status: unknown) => CANCELLED_STATUSES.has(String(status ?? "").toLowerCase());
