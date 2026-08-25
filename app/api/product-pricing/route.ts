import {NextResponse} from "next/server";
import {requireUser} from "@/lib/auth";
export async function POST(req:Request){
 try{const b=await req.json();const {supabase, organizationId}=await requireUser();const {product_id,...values}=b;
  const {data:settings}=await supabase.from('organization_settings').select('labor_hour_rate').eq('organization_id',organizationId).maybeSingle();
  const laborRate=Number(settings?.labor_hour_rate ?? b.labor_hour ?? 30);
  values.labor_hour=laborRate;
  const {error}=await supabase.from("product_pricing").upsert({product_id,...values},{onConflict:"product_id"});if(error)throw error;
  const {error:pe}=await supabase.from("products").update({sale_price:Number(b.suggested_price||0),estimated_cost:Number(b.total_cost||0)}).eq("id",product_id);if(pe)throw pe;
  return NextResponse.json({ok:true});
 }catch(e:any){return NextResponse.json({error:e.message||"Erro ao salvar precificação."},{status:500})}
}
