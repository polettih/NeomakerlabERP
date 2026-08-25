import {NextResponse} from "next/server"; import {requireUser} from "@/lib/auth";
export async function POST(request:Request){
  const {supabase}=await requireUser();
  try{
    const body=await request.json(); if(!body.items?.length)return NextResponse.json({error:"Adicione pelo menos um produto."},{status:400});
    const {data:member}=await supabase.from("organization_members").select("organization_id").limit(1).single();if(!member)throw new Error("Organização não encontrada.");
    const ids=body.items.map((i:any)=>i.product_id);const {data:products,error:pe}=await supabase.from("products").select("id,name,sale_price,estimated_cost").in("id",ids);if(pe)throw pe;
    const items=body.items.map((i:any)=>{const p=products?.find(x=>x.id===i.product_id);if(!p)throw new Error("Produto inválido.");const q=Math.max(Number(i.quantity||1),1);return {product_id:p.id,product_name:p.name,quantity:q,unit_price:Number(p.sale_price),unit_cost:Number(p.estimated_cost),discount:0,total:Number(p.sale_price)*q};});
    const subtotal=items.reduce((s:number,i:any)=>s+i.total,0);const discount=Math.max(Number(body.discount||0),0);const shipping=Math.max(Number(body.shipping_cost||0),0);const total=Math.max(subtotal-discount+shipping,0);
    const {data:order,error:oe}=await supabase.from("orders").insert({organization_id:member.organization_id,customer_id:body.customer_id||null,sales_channel_id:body.sales_channel_id||null,status:"new",payment_status:"pending",subtotal,discount,shipping_cost:shipping,marketplace_fee:Math.max(Number(body.marketplace_fee||0),0),total}).select().single();if(oe)throw oe;
    const {error:ie}=await supabase.from("order_items").insert(items.map((i:any)=>({...i,order_id:order.id})));if(ie)throw ie;
    const {error:he}=await supabase.from("order_status_history").insert({order_id:order.id,new_status:"new"});if(he)throw he;
    const {error:pr}=await supabase.from("production_orders").insert({organization_id:member.organization_id,order_id:order.id,status:"pending"});if(pr)throw pr;
    return NextResponse.json(order);
  }catch(e:any){return NextResponse.json({error:e.message||"Erro interno"},{status:500})}
}