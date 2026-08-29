import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, organizationId } = await requireUser();
    const { data: payment } = await supabase
      .from("payments")
      .select("order_id")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .single();
    const { error } = await supabase
      .from("payments")
      .delete()
      .eq("id", id)
      .eq("organization_id", organizationId);
    if (error) throw error;

    if (payment?.order_id) {
      const { data: order } = await supabase
        .from("orders")
        .select("id,total,gross_total,payment_status")
        .eq("id", payment.order_id)
        .single();
      if (order) {
        const { data: payments } = await supabase
          .from("payments")
          .select("amount")
          .eq("order_id", payment.order_id);
        const received = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
        const orderTotal = Number(order.gross_total ?? order.total);
        const nextStatus = received <= 0 ? "pending" : received >= orderTotal ? "paid" : "partial";
        if (nextStatus !== order.payment_status) {
          await supabase
            .from("orders")
            .update({ payment_status: nextStatus })
            .eq("id", payment.order_id);
        }
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: errorMessage(e, "Erro ao excluir pagamento.") },
      { status: 500 }
    );
  }
}
