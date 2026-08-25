import {requireUser} from "@/lib/auth"; import {CreateExpenseForm} from "@/components/create-expense-form";
const money=(v:number)=>v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
export default async function FinanceiroPage(){
  const {supabase}=await requireUser();
  const [{data:payments},{data:expenses}]=await Promise.all([
    supabase.from("payments").select("id,description,amount,payment_method,payment_date").order("payment_date",{ascending:false}),
    supabase.from("expenses").select("id,description,category,amount,status,due_date").order("created_at",{ascending:false})
  ]);
  const received=(payments??[]).reduce((s,p)=>s+Number(p.amount),0); const spent=(expenses??[]).filter(e=>e.status!=="cancelled").reduce((s,e)=>s+Number(e.amount),0);
  return <div className="content"><div className="section-title"><div><h1>Financeiro</h1><p className="muted">Entradas e saídas</p></div></div>
    <div className="grid cards"><div className="card"><div className="label">Recebido</div><div className="value kpi-green">{money(received)}</div></div><div className="card"><div className="label">Despesas</div><div className="value">{money(spent)}</div></div><div className="card"><div className="label">Saldo caixa</div><div className="value">{money(received-spent)}</div></div><div className="card"><div className="label">Lançamentos</div><div className="value">{(payments??[]).length+(expenses??[]).length}</div></div></div>
    <div className="grid" style={{gridTemplateColumns:"1fr 2fr",marginTop:18}}><CreateExpenseForm/><div className="table-wrap"><table><thead><tr><th>Descrição</th><th>Categoria</th><th>Valor</th><th>Status</th></tr></thead><tbody>
      {(expenses??[]).map(e=><tr key={e.id}><td>{e.description}</td><td>{e.category||"-"}</td><td>{money(Number(e.amount))}</td><td><span className="badge">{e.status}</span></td></tr>)}{!expenses?.length&&<tr><td colSpan={4} className="muted">Nenhuma despesa.</td></tr>}
    </tbody></table></div></div>
  </div>;
}