import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase } = await requireUser();
    const { data, error } = await supabase
      .from("sales_channel_tiers")
      .select("id,min_value,max_value,fee_percent,fixed_fee,sort_order")
      .eq("channel_id", id)
      .order("sort_order");
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (e: unknown) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}

type TierInput = { min_value: number; max_value: number | null; fee_percent: number; fixed_fee: number };

// Substitui TODAS as faixas do canal de uma vez (apaga + recria), para evitar estado
// inconsistente de faixas parcialmente editadas. Enviar tiers: [] remove todas as
// faixas e o canal volta a usar fee_percent/fixed_fee simples.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const tiers: TierInput[] = Array.isArray(body.tiers) ? body.tiers : [];

    for (const t of tiers) {
      const fee = Number(t.fee_percent);
      const fixed = Number(t.fixed_fee);
      const min = Number(t.min_value);
      if (!Number.isFinite(min) || min < 0)
        return NextResponse.json({ error: "Valor mínimo de faixa inválido." }, { status: 400 });
      if (!Number.isFinite(fee) || fee < 0 || fee > 1)
        return NextResponse.json(
          { error: "Percentual de taxa deve estar entre 0% e 100%." },
          { status: 400 }
        );
      if (!Number.isFinite(fixed) || fixed < 0)
        return NextResponse.json({ error: "Taxa fixa inválida." }, { status: 400 });
    }

    const { supabase, organizationId } = await requireUser();
    const { error: de } = await supabase.from("sales_channel_tiers").delete().eq("channel_id", id);
    if (de) throw de;

    if (tiers.length) {
      const rows = tiers.map((t, i) => ({
        organization_id: organizationId,
        channel_id: id,
        min_value: Number(t.min_value),
        max_value: t.max_value === null || t.max_value === undefined ? null : Number(t.max_value),
        fee_percent: Number(t.fee_percent),
        fixed_fee: Number(t.fixed_fee),
        sort_order: i,
      }));
      const { error: ie } = await supabase.from("sales_channel_tiers").insert(rows);
      if (ie) throw ie;
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
