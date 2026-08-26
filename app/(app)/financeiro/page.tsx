import { requireUser } from "@/lib/auth";
import { CreateExpenseForm } from "@/components/create-expense-form";
import { FinanceTabs } from "@/components/finance-tabs";
import { FinancialHistory } from "@/components/financial-history";

type Row={category:string;qty:number;gross:number;received:number;receivable:number;cost:number;fees:number;labor:number};
type HistoryRow={key:string;label:string;gross:number;received:number;purchases:number;expenses:number;equipment:number;outflow:number;cashResult:number;cumulative:number;receivable:number;payable:number};
const numberValue=(v:unknown)=>Number(v??0);
const monthKey=(date:unknown)=>{const d=new Date(String(date)); return Number.isNaN(d.getTime())?null:`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}`};
const monthLabel=(key:string)=>{const [y,m]=key.split("-").map(Number);return new Intl.DateTimeFormat("pt-BR",{month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(Date.UTC(y,m-1,1))).replace(" de ","/").replace(".","")};
const isPaidExpense=(status:unknown)=>String(status)==="paid";

export default async function FinanceiroPage(){
 const {supabase,organizationId}=await requireUser();
 const [{data:orders},{data:items},{data:payments},{data:expenses},{data:materialPurchases},{data:settings}]=await Promise.all([
  supabase.from("orders").select("id,status,total,gross_total,shipping_cost,marketplace_fee,order_date"),
  supabase.from("order_items").select("order_id,product_name,quantity,unit_price,unit_cost,total,products(category),product_id"),
  supabase.from("payments").select("order_id,amount,payment_date"),
  supabase.from("expenses").select("id,description,category,amount,status,due_date,paid_at,created_at,source_type,source_id").order("created_at",{ascending:false}),
  supabase.from("material_purchases").select("id,total_cost,created_at"),
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
 const validExpenses=(expenses??[]).filter(e=>e.status!=="cancelled");
 const paidExpenses=validExpenses.filter(e=>isPaidExpense(e.status)).reduce((s,e)=>s+numberValue(e.amount),0);
 const payable=validExpenses.filter(e=>!isPaidExpense(e.status)).reduce((s,e)=>s+numberValue(e.amount),0);
 const materialPurchasesTotal=(materialPurchases??[]).reduce((s,e)=>s+numberValue(e.total_cost),0);
 const totalCashOut=paidExpenses+materialPurchasesTotal;
 const cashResult=totalReceived-totalCashOut;
 const rows=Object.values(rowsMap).sort((a,b)=>b.gross-a.gross); const profit=totalGross-totalCost-totalFees;

 const historyMap=new Map<string,HistoryRow>();
 const ensureMonth=(key:string)=>{let row=historyMap.get(key);if(!row){row={key,label:monthLabel(key),gross:0,received:0,purchases:0,expenses:0,equipment:0,outflow:0,cashResult:0,cumulative:0,receivable:0,payable:0};historyMap.set(key,row);}return row;};
 for(const order of validOrders){const key=monthKey(order.order_date);if(!key)continue;const row=ensureMonth(key);row.gross+=numberValue(order.gross_total??order.total);}
 for(const p of payments??[]){if(!p.order_id||!validIds.has(p.order_id))continue;const key=monthKey(p.payment_date);if(!key)continue;ensureMonth(key).received+=numberValue(p.amount);}
 for(const purchase of materialPurchases??[]){const key=monthKey(purchase.created_at);if(!key)continue;ensureMonth(key).purchases+=numberValue(purchase.total_cost);}
 for(const expense of validExpenses){
  const date=isPaidExpense(expense.status)?(expense.paid_at||expense.due_date||expense.created_at):(expense.due_date||expense.created_at); const key=monthKey(date);if(!key)continue;const row=ensureMonth(key);
  if(isPaidExpense(expense.status)){if(expense.source_type==="machine_purchase")row.equipment+=numberValue(expense.amount);else row.expenses+=numberValue(expense.amount);}
  else row.payable+=numberValue(expense.amount);
 }
 const historyRows=[...historyMap.values()].sort((a,b)=>a.key.localeCompare(b.key));
 let cumulative=0; for(const row of historyRows){row.outflow=row.purchases+row.expenses+row.equipment;row.cashResult=row.received-row.outflow;cumulative+=row.cashResult;row.cumulative=cumulative;}
 let cumulativeReceivable=0; for(const row of historyRows){cumulativeReceivable+=Math.max(row.gross-row.received,0);row.receivable=Math.max(cumulativeReceivable,0);}
 const payableTotal=validExpenses.filter(e=>!isPaidExpense(e.status)).reduce((s,e)=>s+numberValue(e.amount),0); if(historyRows.length)historyRows[historyRows.length-1].payable=payableTotal;

 const money=(value:number)=>{const abs=Math.abs(value).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});return value<0?`R$ - ${abs.replace(/^R\$\s?/,"")}`:abs};
 return <div className="content"><div className="section-title"><div><h1>Financeiro</h1><p className="muted">Acompanhe vendas, recebimentos, custos, fluxo de caixa e histórico da operação.</p></div></div>
  <FinanceTabs summary={{qty:totalQty,gross:totalGross,received:totalReceived,receivable:Math.max(totalGross-totalReceived,0),profit}} rows={rows} fees={{total:totalFees,count:validOrders.filter(o=>numberValue(o.marketplace_fee)>0).length}} labor={{total:totalLabor,items:totalLaborItems}} spent={totalCashOut} initialLaborHourRate={Number(settings?.labor_hour_rate ?? 30)}/>
  <div className="grid three-col" style={{marginTop:18}}><div className="card"><span className="muted">Compras de insumos</span><h2>{money(materialPurchasesTotal)}</h2></div><div className="card"><span className="muted">Contas a pagar</span><h2 className={payableTotal>0?"error":""}>{payableTotal>0?money(-payableTotal):money(0)}</h2></div><div className="card"><span className="muted">Fluxo de caixa acumulado</span><h2 className={cashResult<0?"error":""}>{cashResult<0?money(cashResult):`R$ ${cashResult.toLocaleString("pt-BR",{minimumFractionDigits:2})}`}</h2></div></div>
  <FinancialHistory rows={historyRows}/>
  <div className="grid" style={{gridTemplateColumns:"1fr 2fr",marginTop:18}}><CreateExpenseForm/><div className="card"><h2>Gastos e compras</h2><div className="table-wrap"><table><thead><tr><th>Descrição</th><th>Categoria</th><th>Valor</th><th>Status</th></tr></thead><tbody>{(expenses??[]).map(e=><tr key={e.id}><td>{e.description}</td><td>{e.category||"-"}</td><td>{numberValue(e.amount).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</td><td><span className="badge">{e.status}</span></td></tr>)}{!expenses?.length&&<tr><td colSpan={4} className="muted">Nenhuma despesa.</td></tr>}</tbody></table></div></div></div>
 </div>;
}
