import {requireUser} from "@/lib/auth";
export default async function ProducaoPage(){
  const {supabase}=await requireUser(); const {data}=await supabase.from("production_orders").select("id,status,priority,created_at,orders(id,total,status)").order("priority",{ascending:false}).order("created_at",{ascending:true});
  return <div className="content"><div className="section-title"><div><h1>Produção</h1><p className="muted">Fila de produção</p></div></div>
    <div className="grid" style={{gridTemplateColumns:"repeat(3,1fr)"}}>{["pending","in_progress","completed"].map(status=><div className="card" key={status}><h2>{status==="pending"?"Pendente":status==="in_progress"?"Em andamento":"Concluído"}</h2>
      <div className="grid" style={{marginTop:14}}>{(data??[]).filter((x:any)=>x.status===status).map((x:any)=><div className="card" key={x.id} style={{background:"#0f1318"}}><strong>Pedido {x.orders?.id?.slice(0,8)}</strong><p className="muted">Prioridade {x.priority}</p></div>)}</div>
    </div>)}</div>
  </div>;
}