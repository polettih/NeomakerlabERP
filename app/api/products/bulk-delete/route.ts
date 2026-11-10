import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";

/** Exclui vários produtos de uma vez. Pedidos antigos mantêm o nome gravado no item. */
export async function POST(req: Request) {
  try {
    const { supabase, organizationId } = await requireUser();
    const b = await req.json();
    const ids = [...new Set(((b.ids ?? []) as unknown[]).map(String))].slice(0, 500);
    if (!ids.length)
      return NextResponse.json({ error: "Nenhum produto selecionado." }, { status: 400 });
    const { data, error } = await supabase
      .from("products")
      .delete()
      .eq("organization_id", organizationId)
      .in("id", ids)
      .select("id");
    if (error) throw error;
    return NextResponse.json({ deleted: data?.length ?? 0 });
  } catch (e) {
    return NextResponse.json(
      { error: errorMessage(e, "Erro ao excluir produtos.") },
      { status: 500 }
    );
  }
}
