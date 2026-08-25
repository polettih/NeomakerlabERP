import {requireUser} from "@/lib/auth"; import {CreateProductForm} from "@/components/create-product-form";
const money=(v:number)=>v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
export default async function ProdutosPage(){
  const {supabase}=await requireUser(); const {data}=await supabase.from("products").select("id,name,sku,sale_price,estimated_cost,active,created_at").order("created_at",{ascending:false});
  return <div className="content"><div className="section-title"><div><h1>Produtos</h1><p className="muted">Catálogo e custo base</p></div></div>
    <div className="grid" style={{gridTemplateColumns:"1fr 2fr"}}><CreateProductForm/><div className="table-wrap"><table><thead><tr><th>Produto</th><th>Preço</th><th>Custo</th><th>Margem base</th></tr></thead><tbody>
      {(data??[]).map(p=><tr key={p.id}><td>{p.name}</td><td>{money(Number(p.sale_price))}</td><td>{money(Number(p.estimated_cost))}</td><td>{money(Number(p.sale_price)-Number(p.estimated_cost))}</td></tr>)}
      {!data?.length&&<tr><td colSpan={4} className="muted">Nenhum produto cadastrado.</td></tr>}
    </tbody></table></div></div>
  </div>;
}