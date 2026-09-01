import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";

export async function GET() {
  try {
    const { supabase, organizationId } = await requireUser();
    const { data, error } = await supabase
      .from("organization_settings")
      .select("labor_hour_rate")
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ labor_hour_rate: Number(data?.labor_hour_rate ?? 30) });
  } catch (e) {
    return NextResponse.json(
      { error: errorMessage(e, "Erro ao carregar valor da hora.") },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, organizationId } = await requireUser();
    const body = await req.json();
    const rate = Number(body.labor_hour_rate);

    if (!Number.isFinite(rate) || rate < 0) {
      return NextResponse.json({ error: "Informe um valor de hora válido." }, { status: 400 });
    }

    const { error } = await supabase.from("organization_settings").upsert(
      {
        organization_id: organizationId,
        labor_hour_rate: rate,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id" }
    );

    if (error) throw error;

    return NextResponse.json({ ok: true, labor_hour_rate: rate });
  } catch (e) {
    return NextResponse.json(
      { error: errorMessage(e, "Erro ao salvar valor da hora.") },
      { status: 500 }
    );
  }
}
