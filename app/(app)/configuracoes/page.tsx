import {requireUser} from "@/lib/auth";
export default async function ConfiguracoesPage(){
  const {supabase}=await requireUser(); const {data}=await supabase.from("sales_channels").select("id,name,active").order("name");
  return <div className="content"><div className="section-title"><div><h1>Configurações</h1><p className="muted">Canais de venda</p></div></div>
    <div className="card"><h2>Canais cadastrados</h2><div className="table-wrap" style={{marginTop:16}}><table><thead><tr><th>Nome</th><th>Ativo</th></tr></thead><tbody>{(data??[]).map(c=><tr key={c.id}><td>{c.name}</td><td><span className="badge green">{c.active?"Sim":"Não"}</span></td></tr>)}</tbody></table></div></div>
  </div>;
}