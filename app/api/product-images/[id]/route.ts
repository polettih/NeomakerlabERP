import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, organizationId } = await requireUser();
    const { data: image, error: getErr } = await supabase
      .from("product_images")
      .select("id,storage_path")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .single();
    if (getErr) throw getErr;
    if (image?.storage_path)
      await supabase.storage.from("product-images").remove([image.storage_path]);
    const { error } = await supabase
      .from("product_images")
      .delete()
      .eq("id", id)
      .eq("organization_id", organizationId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: errorMessage(e, "Erro ao remover foto.") }, { status: 500 });
  }
}
