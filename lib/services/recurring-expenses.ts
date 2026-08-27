import type { SupabaseClient } from "@supabase/supabase-js";

type RecurringExpense = {
  id: string;
  organization_id: string;
  description: string;
  category: string | null;
  amount: number;
  day_of_month: number;
  active: boolean;
};

/**
 * Garante que toda despesa recorrente ativa da organização já tenha uma
 * despesa gerada para o mês corrente. É seguro chamar isso a cada carregamento
 * da página de financeiro: usa upsert com ignoreDuplicates para nunca duplicar.
 */
export async function ensureRecurringExpensesForCurrentMonth(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const { data: recurring, error } = await supabase
    .from("recurring_expenses")
    .select("id,organization_id,description,category,amount,day_of_month,active")
    .eq("organization_id", organizationId)
    .eq("active", true);

  if (error || !recurring?.length) return;

  const now = new Date();
  const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;

  const rows = (recurring as RecurringExpense[]).map((r) => {
    const day = Math.min(Math.max(r.day_of_month, 1), 28);
    const dueDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day));
    return {
      organization_id: r.organization_id,
      description: r.description,
      category: r.category,
      amount: r.amount,
      status: "pending" as const,
      due_date: dueDate.toISOString().slice(0, 10),
      source_type: "recurring",
      source_id: r.id,
      generated_period: period,
    };
  });

  await supabase
    .from("expenses")
    .upsert(rows, {
      onConflict: "source_type,source_id,generated_period",
      ignoreDuplicates: true,
    });
}
