import {requireUser} from "@/lib/auth";
import {CreateExpenseForm} from "@/components/create-expense-form";
const money=(v:number)=>v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
export default async function GastosPage(){
 const {supabase}=await requireUser();
 const {data}=await supabase.from("expenses").select("id,description,category,amount,status,due_date,created_at").order("created_at",{ascending:false});
 return <div className="content"><div className="section-title"><div><h1>Gastos e compras</h1><p className="muted">Materiais, compras, ferramentas, embalagem e demais gastos da operação.</p></div></div>
 <div className="grid two-col"><CreateExpenseForm/><div className="table-wrap"><table><thead><tr><th>Descrição</th><th>Categoria</th><th>Valor</th><th>Status</th></tr></thead><tbody>{(data??[]).map(e=><tr key={e.id}><td>{e.description}</td><td>{e.category||"-"}</td><td>{money(Number(e.amount))}</td><td><span className="badge">{e.status}</span></td></tr>)}{!data?.length&&<tr><td colSpan={4} className="muted">Nenhum gasto ou compra lançado.</td></tr>}</tbody></table></div></div>
 </div>;
}
