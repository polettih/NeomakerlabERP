import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";

export async function GET() {
  try {
    const { supabase, organizationId } = await requireUser();
    const { data, error } = await supabase
      .from("organization_settings")
      .select("labor_hour_rate,energy_cost_kwh")
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({
      labor_hour_rate: Number(data?.labor_hour_rate ?? 30),
      energy_cost_kwh: Number(data?.energy_cost_kwh ?? 1.12),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: errorMessage(e, "Erro ao carregar configurações.") },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, organizationId } = await requireUser();
    const body = await req.json();
    const update: Record<string, unknown> = {
      organization_id: organizationId,
      updated_at: new Date().toISOString(),
    };
    if (body.labor_hour_rate !== undefined) {
      const rate = Number(body.labor_hour_rate);
      if (!Number.isFinite(rate) || rate < 0)
        return NextResponse.json({ error: "Informe um valor de hora válido." }, { status: 400 });
      update.labor_hour_rate = rate;
    }
    if (body.energy_cost_kwh !== undefined) {
      const kwh = Number(body.energy_cost_kwh);
      if (!Number.isFinite(kwh) || kwh < 0)
        return NextResponse.json(
          { error: "Informe um custo de energia válido." },
          { status: 400 }
        );
      update.energy_cost_kwh = kwh;
    }
    const { error } = await supabase
      .from("organization_settings")
      .upsert(update, { onConflict: "organization_id" });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: errorMessage(e, "Erro ao salvar configurações.") },
      { status: 500 }
    );
  }
}
