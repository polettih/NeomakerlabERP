import {requireUser} from '@/lib/auth';
import {CreateExpenseForm} from '@/components/create-expense-form';
import {InventoryManager} from '@/components/inventory-manager';
const money=(v:number)=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export default async function GastosPage(){
 const {supabase}=await requireUser();
 const [{data:materials},{data:expenses},{data:purchases}]=await Promise.all([
   supabase.from('materials').select('*').eq('active',true).order('material_type').order('name'),
   supabase.from('expenses').select('id,description,category,amount,status,due_date,created_at').order('created_at',{ascending:false}),
   supabase.from('material_purchases').select('id,total_cost,created_at').order('created_at',{ascending:false})
 ]);
 const materialPurchasesTotal=(purchases??[]).reduce((sum: number,e: {total_cost?: number | string | null})=>sum+Number(e.total_cost||0),0); const expenseTotal=(expenses??[]).filter(e=>e.status!=="cancelled").reduce((sum: number,e: {amount?: number | string | null})=>sum+Number(e.amount||0),0); const stockValue=(materials??[]).reduce((sum: number,m: {quantity_on_hand?: number | string | null; average_cost?: number | string | null})=>sum+Number(m.quantity_on_hand||0)*Number(m.average_cost||0),0);
 return <div className="content"><div className="section-title"><div><h1>🛒 Gastos e compras</h1><p className="muted">Gestão unificada de estoque, compras, insumos e demais gastos da operação.</p></div></div>
 <div className="grid three-col" style={{marginBottom:18}}><div className="card"><span className="muted">Materiais cadastrados</span><h2>{materials?.length||0}</h2></div><div className="card"><span className="muted">Valor em estoque</span><h2>{money(stockValue)}</h2></div><div className="card"><span className="muted">Saídas registradas</span><h2>{money(expenseTotal+materialPurchasesTotal)}</h2></div></div>
 <InventoryManager materials={materials??[]}/>
 <div className="grid two-col" style={{marginTop:18}}><CreateExpenseForm/><div className="card table-wrap"><h2>Outros gastos</h2><table><thead><tr><th>Descrição</th><th>Categoria</th><th>Valor</th><th>Status</th></tr></thead><tbody>{(expenses??[]).map(e=><tr key={e.id}><td>{e.description}</td><td>{e.category||'-'}</td><td>{money(Number(e.amount))}</td><td><span className="badge">{e.status}</span></td></tr>)}{!expenses?.length&&<tr><td colSpan={4} className="muted">Nenhum gasto lançado.</td></tr>}</tbody></table></div></div>
 </div>;
}
