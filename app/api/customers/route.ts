import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
export async function POST(request: Request) {
  try {
    const b = await request.json();
    const { supabase, organizationId } = await requireUser();
    const { data, error } = await supabase
      .from("customers")
      .insert({
        organization_id: organizationId,
        name: b.name,
        email: b.email || null,
        phone: b.phone || null,
        behavior: b.behavior || "Normal",
        notes: b.notes || null,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
export async function PUT(request: Request) {
  try {
    const b = await request.json();
    const { supabase, organizationId } = await requireUser();
    const { error } = await supabase
      .from("customers")
      .update({
        name: b.name,
        email: b.email || null,
        phone: b.phone || null,
        behavior: b.behavior,
        notes: b.notes || null,
      })
      .eq("id", b.id)
      .eq("organization_id", organizationId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    const { supabase, organizationId } = await requireUser();
    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", id)
      .eq("organization_id", organizationId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
