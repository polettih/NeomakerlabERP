import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";

/**
 * Exclui vários pedidos. Cada um passa pela mesma função do banco da exclusão individual
 * (delete_order_with_stock_restore): apaga pagamentos e devolve ao estoque o material que a
 * produção já tinha consumido.
 */
export async function POST(req: Request) {
  try {
    const { supabase, organizationId } = await requireUser();
    const b = await req.json();
    const requested = [...new Set(((b.ids ?? []) as unknown[]).map(String))].slice(0, 300);
    if (!requested.length)
      return NextResponse.json({ error: "Nenhum pedido selecionado." }, { status: 400 });
    // Só aceita pedidos da própria organização.
    const { data: mine, error: me } = await supabase
      .from("orders")
      .select("id")
      .eq("organization_id", organizationId)
      .in("id", requested);
    if (me) throw me;
    let deleted = 0;
    const errors: string[] = [];
    for (const o of mine ?? []) {
      const { error } = await supabase.rpc("delete_order_with_stock_restore", { p_order: o.id });
      if (error) errors.push(errorMessage(error, "Erro ao excluir um pedido."));
      else deleted++;
    }
    return NextResponse.json({ deleted, errors: [...new Set(errors)] });
  } catch (e) {
    return NextResponse.json(
      { error: errorMessage(e, "Erro ao excluir pedidos.") },
      { status: 500 }
    );
  }
}
