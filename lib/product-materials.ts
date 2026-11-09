/**
 * Regras de material compartilhadas pelos formulários de produto (cadastro e edição),
 * que antes tinham cada uma a sua cópia da conversão kg↔g e do cálculo de custo.
 * Materiais em "kg" são digitados em gramas na tela e guardados em kg no banco.
 */
export type MaterialLike = {
  id: string;
  unit?: string | null;
  average_cost?: number | string | null;
};

const num = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

export const isKg = (m: MaterialLike | undefined) => (m?.unit || "").toLowerCase() === "kg";

/** Quantidade digitada na tela → quantidade guardada (kg quando a unidade é kg). */
export const toStoredQuantity = (m: MaterialLike | undefined, shown: number) =>
  num(shown) / (isKg(m) ? 1000 : 1);

/** Quantidade guardada → quantidade exibida (gramas quando a unidade é kg). */
export const toDisplayQuantity = (m: MaterialLike | undefined, stored: number) =>
  num(stored) * (isKg(m) ? 1000 : 1);

/** Custo de uma quantidade digitada na tela (em g quando o material é em kg). */
export const costOfShown = (m: MaterialLike | undefined, shown: number) =>
  m ? toStoredQuantity(m, shown) * num(m.average_cost) : 0;
