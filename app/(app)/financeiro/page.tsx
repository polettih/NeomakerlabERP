import { requireUser } from "@/lib/auth";
import { CreateExpenseForm } from "@/components/create-expense-form";
import { FinanceTabs } from "@/components/finance-tabs";

type Row={category:string;qty:number;gross:number;received:number;receivable:number;cost:number;fees:number;labor:number};
const numberValue=(v:unknown)=>Number(v??0);
export default async function FinanceiroPage(){
 const {supabase,organizationId}=await requireUser();
 const [{data:orders},{data:items},{data:payments},{data:expenses},{data:settings}]=await Promise.all([
  supabase.from("orders").select("id,status,total,gross_total,shipping_cost,marketplace_fee"),
  supabase.from("order_items").select("order_id,product_name,quantity,unit_price,unit_cost,total,products(category),product_id"),
  supabase.from("payments").select("order_id,amount"),
  supabase.from("expenses").select("id,description,category,amount,status,due_date").order("created_at",{ascending:false}),
  supabase.from("organization_settings").select("labor_hour_rate").eq("organization_id",organizationId).maybeSingle()
 ]);
 const validOrders=(orders??[]).filter(o=>o.status!=="cancelled"); const validIds=new Set(validOrders.map(o=>o.id));
 const paid=new Map<string,number>(); for(const p of payments??[]){if(p.order_id&&validIds.has(p.order_id))paid.set(p.order_id,(paid.get(p.order_id)??0)+numberValue(p.amount));}
 const productIds=[...new Set((items??[]).map(i=>i.product_id).filter((id): id is string => Boolean(id)))];
 const pricing=new Map<string,number>();
 if(productIds.length){const {data}=await supabase.from("product_pricing").select("product_id,labor_cost").in("product_id",productIds); for(const p of data??[]) pricing.set(p.product_id,numberValue(p.labor_cost));}
 const rowsMap:Record<string,Row>={}; let totalGross=0,totalReceived=0,totalCost=0,totalFees=0,totalLabor=0,totalQty=0,totalLaborItems=0;
 for(const order of validOrders){
  const orderItems=(items??[]).filter(i=>i.order_id===order.id); const merchandise=orderItems.reduce((s,i)=>s+(numberValue(i.total)||numberValue(i.unit_price)*numberValue(i.quantity)),0); const gross=numberValue(order.gross_total??order.total); const fee=numberValue(order.marketplace_fee); const received=paid.get(order.id)??0;
  totalGross+=gross; totalFees+=fee; totalReceived+=received;
  for(const item of orderItems){
   const product=Array.isArray(item.products)?item.products[0]:item.products; const category=product?.category||"Outros"; const qty=numberValue(item.quantity); const base=numberValue(item.total)||numberValue(item.unit_price)*qty; const share=merchandise>0?base/merchandise:0; const row=rowsMap[category]??(rowsMap[category]={category,qty:0,gross:0,received:0,receivable:0,cost:0,fees:0,labor:0});
   row.qty+=qty; row.gross+=gross*share; row.received+=received*share; row.cost+=numberValue(item.unit_cost)*qty; row.fees+=fee*share; const productId=item.product_id; const laborPerUnit=productId ? (pricing.get(productId)??0) : 0; row.labor+=laborPerUnit*qty; totalCost+=numberValue(item.unit_cost)*qty; totalLabor+=laborPerUnit*qty; totalQty+=qty; if(laborPerUnit>0) totalLaborItems+=qty;
  }
 }
 for(const row of Object.values(rowsMap)) row.receivable=Math.max(row.gross-row.received,0);
 const spent=(expenses??[]).filter(e=>e.status!=="cancelled").reduce((s,e)=>s+numberValue(e.amount),0);
 const rows=Object.values(rowsMap).sort((a,b)=>b.gross-a.gross); const profit=totalGross-totalCost-totalFees;
 return <div className="content"><div className="section-title"><div><h1>Financeiro</h1><p className="muted">Acompanhe venda bruta, taxas do marketplace, mão de obra, recebimentos e lucro.</p></div></div>
  <FinanceTabs summary={{qty:totalQty,gross:totalGross,received:totalReceived,receivable:Math.max(totalGross-totalReceived,0),profit}} rows={rows} fees={{total:totalFees,count:validOrders.filter(o=>numberValue(o.marketplace_fee)>0).length}} labor={{total:totalLabor,items:totalLaborItems}} spent={spent} initialLaborHourRate={Number(settings?.labor_hour_rate ?? 30)}/>
  <div className="grid" style={{gridTemplateColumns:"1fr 2fr",marginTop:18}}><CreateExpenseForm/><div className="card"><h2>Gastos e compras</h2><div className="table-wrap"><table><thead><tr><th>Descrição</th><th>Categoria</th><th>Valor</th><th>Status</th></tr></thead><tbody>{(expenses??[]).map(e=><tr key={e.id}><td>{e.description}</td><td>{e.category||"-"}</td><td>{numberValue(e.amount).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</td><td><span className="badge">{e.status}</span></td></tr>)}{!expenses?.length&&<tr><td colSpan={4} className="muted">Nenhuma despesa.</td></tr>}</tbody></table></div></div></div>
 </div>;
}
