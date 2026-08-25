import {createClient} from "@/lib/supabase/server";

export async function getDashboard(){
  const supabase=await createClient();
  const [{data:orders},{data:payments},{data:expenses},{data:production}]=await Promise.all([
    supabase.from("orders").select("id,status,total,order_date").order("order_date",{ascending:false}),
    supabase.from("payments").select("amount,payment_date"),
    supabase.from("expenses").select("amount,status"),
    supabase.from("production_orders").select("id,status"),
  ]);
  const sales=(orders??[]).filter(o=>o.status!=="cancelled").reduce((s,o)=>s+Number(o.total||0),0);
  const received=(payments??[]).reduce((s,p)=>s+Number(p.amount||0),0);
  const costs=(expenses??[]).filter(e=>e.status!=="cancelled").reduce((s,e)=>s+Number(e.amount||0),0);
  return {sales,received,receivable:Math.max(sales-received,0),costs,profit:received-costs,orders:orders??[],production:production??[]};
}