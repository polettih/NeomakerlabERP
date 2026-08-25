import {requireUser} from "@/lib/auth";
import Link from "next/link";

function googleCalendarUrl(title:string,date:string,details:string){
  const start = new Date(date);
  const end = new Date(start.getTime()+60*60*1000);
  const fmt=(d:Date)=>d.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/, "Z");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${fmt(start)}/${fmt(end)}&details=${encodeURIComponent(details)}`;
}

export default async function CalendarioPage(){
  const {supabase}=await requireUser();
  const {data:orders}=await supabase.from("orders").select("id,order_date,expected_date,status,total,customers(name),order_items(product_name,quantity)").not("expected_date","is",null).order("expected_date");
  return <div className="content">
    <div className="section-title"><div><h1>Calendário</h1><p className="muted">Prazos e compromissos de produção. Os eventos podem ser enviados para seu calendário real.</p></div></div>
    <div className="calendar-note card"><strong>Integração rápida</strong><span className="muted">Cada prazo tem um botão para adicionar ao Google Agenda. O próximo passo pode ser uma sincronização bidirecional via Google Calendar.</span></div>
    <div className="calendar-list">
      {(orders??[]).map((o:any)=>{
        const items=(o.order_items??[]).map((i:any)=>`${i.product_name} (${i.quantity})`).join(", ");
        const title=`NeoMaker — ${items||"Pedido"}`;
        return <div className="calendar-event card" key={o.id}>
          <div className="calendar-date"><strong>{new Date(o.expected_date).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"})}</strong><span>{new Date(o.expected_date).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</span></div>
          <div className="calendar-info"><strong>{title}</strong><span className="muted">Cliente: {o.customers?.name||"Sem cliente"} · Status: {o.status}</span></div>
          <a className="btn btn-secondary" href={googleCalendarUrl(title,o.expected_date,`Pedido ${o.id}`)} target="_blank" rel="noreferrer">+ Google Agenda</a>
        </div>
      })}
      {!orders?.length && <div className="empty card"><strong>Nenhum prazo cadastrado.</strong><p className="muted">Ao criar um pedido, informe a data prevista para ele aparecer aqui.</p><Link className="btn btn-primary" href="/pedidos/novo">+ Novo pedido</Link></div>}
    </div>
  </div>;
}
