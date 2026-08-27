export const EXPENSE_CATEGORIES = [
  "Material",
  "Frete",
  "Marketing",
  "Assinaturas e Software",
  "Equipamento",
  "Impostos e Taxas",
  "Aluguel e Infraestrutura",
  "Embalagem",
  "Manutenção",
  "Outros",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
