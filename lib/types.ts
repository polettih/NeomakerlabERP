/**
 * Tipos de domínio compartilhados. Substituem `any` nos componentes e rotas
 * que já usavam esse formato de dado, sem impor validação de schema (o banco
 * continua sendo a fonte de verdade — ver types/database.ts para os tipos
 * gerados a partir do schema, quando aplicável).
 */

export type Expense = {
  id: string;
  description: string;
  category: string | null;
  amount: unknown;
  status: string | null;
  due_date: string | null;
  paid_at: string | null;
  created_at?: string | null;
  source_type: string | null;
  source_id?: string | null;
};

export type RecurringExpense = {
  id: string;
  description: string;
  category: string | null;
  amount: unknown;
  day_of_month: number;
  active: boolean;
};

export type FinanceCategoryRow = {
  category: string;
  qty: number;
  gross: number;
  received: number;
  receivable: number;
  cost: number;
  fees: number;
  labor: number;
};

export type FinanceHistoryRow = {
  key: string;
  label: string;
  gross: number;
  received: number;
  receivable: number;
  purchases: number;
  expenses: number;
  equipment: number;
  outflow: number;
  cashResult: number;
  cumulative: number;
  payable: number;
};

export type Product = {
  id: string;
  name: string;
  category?: string | null;
  sale_price?: unknown;
  estimated_cost?: unknown;
  active?: boolean;
};

export type Material = {
  id: string;
  name: string;
  category?: string | null;
  material_type?: string | null;
  quantity_on_hand?: unknown;
  average_cost?: unknown;
  active?: boolean;
};

export type ProductMaterialLink = {
  id: string;
  product_id: string;
  material_id: string;
  quantity: unknown;
  material?: Material | null;
};

export type ProductPricing = Record<string, unknown> & { product_id?: string };
