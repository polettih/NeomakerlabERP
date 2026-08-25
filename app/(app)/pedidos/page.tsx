import {requireUser} from "@/lib/auth"; import Link from "next/link";
const money=(v:number)=>v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
export default async function PedidosPage(){
  const {supabase}=await requireUser();
  const {data}=await supabase.from("orders").select("id,status,payment_status,total,order_date,customers(name),sales_channels(name)").order("order_date",{ascending:false});
  return <div className="content"><div className="section-title"><div><h1>Pedidos</h1><p className="muted">Todos os pedidos</p></div><Link className="btn btn-primary" href="/pedidos/novo">+ Novo pedido</Link></div>
    <div className="table-wrap"><table><thead><tr><th>Data</th><th>Cliente</th><th>Canal</th><th>Status</th><th>Pagamento</th><th>Total</th></tr></thead><tbody>
      {(data??[]).map((o:any)=><tr key={o.id}><td>{new Date(o.order_date).toLocaleDateString("pt-BR")}</td><td>{o.customers?.name||"—"}</td><td>{o.sales_channels?.name||"—"}</td><td><span className="badge">{o.status}</span></td><td><span className="badge">{o.payment_status}</span></td><td>{money(Number(o.total))}</td></tr>)}
      {!data?.length&&<tr><td colSpan={6} className="muted">Nenhum pedido cadastrado.</td></tr>}
    </tbody></table></div>
  </div>;
}