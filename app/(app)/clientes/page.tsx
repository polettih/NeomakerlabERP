import {requireUser} from "@/lib/auth"; import {CreateCustomerForm} from "@/components/create-customer-form";
export default async function ClientesPage(){
  const {supabase}=await requireUser(); const {data}=await supabase.from("customers").select("id,name,email,phone,created_at").order("created_at",{ascending:false});
  return <div className="content"><div className="section-title"><div><h1>Clientes</h1><p className="muted">Cadastro de clientes</p></div></div>
    <div className="grid" style={{gridTemplateColumns:"1fr 2fr"}}><CreateCustomerForm/><div className="table-wrap"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Telefone</th><th>Cadastro</th></tr></thead><tbody>
      {(data??[]).map(c=><tr key={c.id}><td>{c.name}</td><td>{c.email||"-"}</td><td>{c.phone||"-"}</td><td>{new Date(c.created_at).toLocaleDateString("pt-BR")}</td></tr>)}
      {!data?.length&&<tr><td colSpan={4} className="muted">Nenhum cliente cadastrado.</td></tr>}
    </tbody></table></div></div>
  </div>;
}