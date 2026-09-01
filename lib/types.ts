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
  /** Receita real de mercadoria (preço × quantidade). Base do lucro. */
  merchandise: number;
  /** Valor total faturado ao cliente (mercadoria + taxa de marketplace + frete). Base do caixa/recebível. */
  billed: number;
  received: number;
  receivable: number;
  cost: number;
  fees: number;
  shipping: number;
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

export type Machine = {
  id: string;
  name: string;
  category: string;
  power_kw?: unknown;
  purchase_value?: unknown;
  useful_hours?: unknown;
  depreciation_per_hour?: unknown;
  active: boolean;
  purchase_date?: string | null;
  notes?: string | null;
};

export type Customer = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  behavior?: string | null;
  notes?: string | null;
};

export type PaintingRecipe = {
  id: string;
  name: string;
  category: string;
  description?: string | null;
  colors: string[];
  dilution?: string | null;
  finish?: string | null;
  notes?: string | null;
  product_id?: string | null;
};

export type OrderItemSummary = { product_name: string; quantity: unknown };
export type OrderSummary = {
  id: string;
  status: string;
  order_date?: string | null;
  expected_date?: string | null;
  customers?: { name: string } | { name: string }[] | null;
  order_items?: OrderItemSummary[];
};
