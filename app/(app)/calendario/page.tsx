import { requireUser } from "@/lib/auth";
import { InteractiveCalendar } from "@/components/interactive-calendar";
export default async function CalendarioPage() {
  const { supabase } = await requireUser();
  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id,order_date,expected_date,completed_at,status,total,customers(name),order_items(product_name,quantity)"
    )
    .or("expected_date.not.is.null,completed_at.not.is.null")
    .order("order_date");
  return (
    <div className="content">
      <div className="section-title">
        <div>
          <h1>Calendário</h1>
          <p className="muted">
            Visualize sua agenda, prazos e andamento dos pedidos em um calendário interativo.
          </p>
        </div>
      </div>
      <InteractiveCalendar orders={orders ?? []} />
    </div>
  );
}
