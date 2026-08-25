import {getDashboard} from "@/lib/services/dashboard";

const money=(v:number)=>v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

export default async function DashboardPage(){
  const d=await getDashboard();
  const pending=d.orders.filter(o=>!["delivered","cancelled"].includes(o.status)).length;
  return <div className="content">
    <div className="section-title"><div><h1>Dashboard</h1><p className="muted">Visão geral da operação</p></div><span className="badge">V1</span></div>
    <div className="grid cards">
      <div className="card"><div className="label">Vendas</div><div className="value">{money(d.sales)}</div></div>
      <div className="card"><div className="label">Recebido</div><div className="value kpi-green">{money(d.received)}</div></div>
      <div className="card"><div className="label">A receber</div><div className="value kpi-yellow">{money(d.receivable)}</div></div>
      <div className="card"><div className="label">Lucro caixa</div><div className="value">{money(d.profit)}</div></div>
    </div>
    <div className="grid" style={{gridTemplateColumns:"2fr 1fr",marginTop:18}}>
      <div className="card"><div className="section-title"><h2>Pedidos recentes</h2><span className="muted">{pending} em aberto</span></div>
        <div className="table-wrap"><table><thead><tr><th>Data</th><th>Status</th><th>Valor</th></tr></thead><tbody>
          {d.orders.slice(0,8).map(o=><tr key={o.id}><td>{new Date(o.order_date).toLocaleDateString("pt-BR")}</td><td><span className="badge">{o.status}</span></td><td>{money(Number(o.total))}</td></tr>)}
          {d.orders.length===0&&<tr><td colSpan={3} className="muted">Nenhum pedido ainda.</td></tr>}
        </tbody></table></div>
      </div>
      <div className="card"><h2>Produção</h2><p className="muted">Fila atual</p>
        <div className="grid" style={{marginTop:16}}>{["pending","in_progress","completed"].map(s=><div key={s} style={{display:"flex",justifyContent:"space-between"}}><span>{s}</span><strong>{d.production.filter(p=>p.status===s).length}</strong></div>)}</div>
      </div>
    </div>
  </div>;
}