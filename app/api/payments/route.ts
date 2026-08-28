import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";

const PAYMENT_METHODS = ["pix", "cash", "credit_card", "debit_card", "bank_transfer", "marketplace", "other"];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Informe um valor válido." }, { status: 400 });
    }
    const method = PAYMENT_METHODS.includes(body.payment_method) ? body.payment_method : "pix";
    const { supabase, organizationId } = await requireUser();

    const { data: payment, error } = await supabase
      .from("payments")
      .insert({
        organization_id: organizationId,
        order_id: body.order_id || null,
        description: body.description || null,
        amount,
        payment_method: method,
        payment_date: body.payment_date || new Date().toISOString(),
        notes: body.notes || null,
      })
      .select()
      .single();
    if (error) throw error;

    // Se o pagamento está vinculado a um pedido, atualiza o status de
    // pagamento do pedido automaticamente com base no total já recebido.
    if (body.order_id) {
      const { data: order } = await supabase
        .from("orders")
        .select("id,total,gross_total,payment_status")
        .eq("id", body.order_id)
        .single();
      if (order) {
        const { data: payments } = await supabase
          .from("payments")
          .select("amount")
          .eq("order_id", body.order_id);
        const received = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
        const orderTotal = Number(order.gross_total ?? order.total);
        const nextStatus = received <= 0 ? "pending" : received >= orderTotal ? "paid" : "partial";
        if (nextStatus !== order.payment_status) {
          await supabase.from("orders").update({ payment_status: nextStatus }).eq("id", body.order_id);
        }
      }
    }

    return NextResponse.json(payment);
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e, "Erro ao registrar pagamento.") }, { status: 500 });
  }
}
