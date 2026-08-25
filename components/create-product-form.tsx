"use client";
import { FormEvent, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const cats=["Bonecos","Objetos","Miniaturas","Decoração","Outros"];
const money=(n:number)=>n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

type Material={id:string;name:string;category:string;unit:string;average_cost:number};

type Props={materials:Material[];laborHourRate:number};

export function CreateProductForm({materials,laborHourRate}:Props){
 const r=useRouter(); const ref=useRef<HTMLInputElement>(null);
 const [open,setOpen]=useState(false); const [name,setName]=useState(""); const [category,setCategory]=useState("Bonecos"); const [files,setFiles]=useState<FileList|null>(null); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
 const [links,setLinks]=useState<{material_id:string;quantity:string}[]>([]);
 const [materialId,setMaterialId]=useState(materials[0]?.id||""); const [materialQty,setMaterialQty]=useState("1");
 const [p,setP]=useState({filament_hours:"0",resin_hours:"0",painting_hours:"0",finishing_hours:"0",energy_cost_kwh:"1.12",filament_power_kw:"0.12",resin_power_kw:"0.07",filament_depr_hour:"0",resin_depr_hour:"0",painting_materials:"0",packaging_cost:"0",other_cost:"0",loss_percent:"8",margin_percent:"20",marketplace_commission:"14"});
 const n=(k:keyof typeof p)=>Number(p[k]||0);
 const materialCost=useMemo(()=>links.reduce((s,l)=>{const m=materials.find(x=>x.id===l.material_id);return s+Number(l.quantity||0)*Number(m?.average_cost||0)},0),[links,materials]);
 const waste=materialCost*n("loss_percent")/100;
 const energy=(n("filament_hours")*n("filament_power_kw")+n("resin_hours")*n("resin_power_kw"))*n("energy_cost_kwh");
 const depreciation=n("filament_hours")*n("filament_depr_hour")+n("resin_hours")*n("resin_depr_hour");
 const labor=(n("painting_hours")+n("finishing_hours"))*laborHourRate;
 const extras=n("painting_materials")+n("packaging_cost")+n("other_cost");
 const total=materialCost+waste+energy+depreciation+labor+extras;
 const suggested=total*(1+n("margin_percent")/100);
 const commission=suggested*n("marketplace_commission")/100;
 const net=suggested-commission; const profit=net-total;
 function set(k:keyof typeof p,v:string){setP(x=>({...x,[k]:v}))}
 function reset(){setName("");setCategory("Bonecos");setFiles(null);if(ref.current)ref.current.value="";setLinks([]);setMaterialId(materials[0]?.id||"");setMaterialQty("1");setP({filament_hours:"0",resin_hours:"0",painting_hours:"0",finishing_hours:"0",energy_cost_kwh:"1.12",filament_power_kw:"0.12",resin_power_kw:"0.07",filament_depr_hour:"0",resin_depr_hour:"0",painting_materials:"0",packaging_cost:"0",other_cost:"0",loss_percent:"8",margin_percent:"20",marketplace_commission:"14"})}
 function addMaterial(){if(!materialId||Number(materialQty)<=0)return;setLinks(prev=>[...prev.filter(x=>x.material_id!==materialId),{material_id:materialId,quantity:materialQty}])}
 async function submit(e:FormEvent){e.preventDefault();setError("");if(!name.trim()){setError("Nome é obrigatório.");return}if(files&&files.length>8){setError("Máximo de 8 fotos.");return}setBusy(true);try{
   const res=await fetch('/api/products',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name.trim(),category,sale_price:suggested,estimated_cost:total})});
   const j=await res.json();if(!res.ok)throw new Error(j.error||'Erro ao criar produto.');
   const productId=j.id;
   if(files?.length){const sb=createClient();const {data:{user}}=await sb.auth.getUser();if(user){const rows:any[]=[];for(let i=0;i<files.length;i++){const f=files[i];const ext=f.name.split('.').pop()||'jpg';const path=`${user.id}/${productId}/${crypto.randomUUID()}.${ext}`;const up=await sb.storage.from('product-images').upload(path,f,{contentType:f.type});if(up.error)throw up.error;const {data:url}=sb.storage.from('product-images').getPublicUrl(path);rows.push({product_id:productId,storage_path:path,public_url:url.publicUrl,sort_order:i})}const ins=await sb.from('product_images').insert(rows);if(ins.error)throw ins.error}}
   const pricing={product_id:productId,filament_hours:n('filament_hours'),resin_hours:n('resin_hours'),painting_hours:n('painting_hours'),finishing_hours:n('finishing_hours'),labor_hour:laborHourRate,painting_materials:n('painting_materials'),packaging_cost:n('packaging_cost'),other_cost:n('other_cost'),energy_cost_kwh:n('energy_cost_kwh'),filament_power_kw:n('filament_power_kw'),resin_power_kw:n('resin_power_kw'),filament_depr_hour:n('filament_depr_hour'),resin_depr_hour:n('resin_depr_hour'),loss_percent:n('loss_percent')/100,margin_percent:n('margin_percent')/100,marketplace_commission:n('marketplace_commission')/100,material_cost:materialCost,energy_cost:energy,depreciation_cost:depreciation,labor_cost:labor,waste_cost:waste,total_cost:total,suggested_price:suggested,net_after_commission:net,profit};
   const pr=await fetch('/api/product-pricing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(pricing)});const pj=await pr.json();if(!pr.ok)throw new Error(pj.error||'Produto criado, mas não foi possível salvar a precificação.');
   for(const l of links){const mr=await fetch('/api/product-materials',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({product_id:productId,material_id:l.material_id,quantity:Number(l.quantity)})});const mj=await mr.json();if(!mr.ok)throw new Error(mj.error||'Produto criado, mas não foi possível salvar os materiais.')}
   reset();setOpen(false);r.refresh();
 }catch(err:any){setError(err.message||'Erro.')}finally{setBusy(false)}}
 return <>
   {!open&&<button className="btn btn-primary" onClick={()=>setOpen(true)}>+ Novo produto</button>}
   {open&&<form onSubmit={submit} className="card grid product-create-expanded">
    <div className="section-title"><div><h2>Novo produto</h2><p className="muted">Cadastre o produto e, se quiser, já configure toda a precificação.</p></div><button type="button" className="btn btn-secondary" onClick={()=>{setOpen(false);setError("")}}>Cancelar</button></div>
    {error&&<div className="error">{error}</div>}
    <div className="section-title"><h3>📦 Dados do produto</h3></div>
    <div className="form-grid"><div className="field"><label>Nome</label><input className="input" value={name} onChange={e=>setName(e.target.value)} required/></div><div className="field"><label>Categoria</label><select className="select" value={category} onChange={e=>setCategory(e.target.value)}>{cats.map(c=><option key={c}>{c}</option>)}</select></div><div className="field"><label>Fotos (até 8)</label><input ref={ref} className="input" type="file" accept="image/*" multiple onChange={e=>setFiles(e.target.files)}/></div></div>
    <div className="section-title"><h3>📦 Materiais consumidos por unidade</h3></div>
    <div className="form-grid"><div className="field"><label>Material</label><select className="select" value={materialId} onChange={e=>setMaterialId(e.target.value)}><option value="">Selecione</option>{materials.map(m=><option key={m.id} value={m.id}>{m.name} — {m.category}</option>)}</select></div><div className="field"><label>Quantidade</label><input className="input" type="number" step="0.001" min="0.001" value={materialQty} onChange={e=>setMaterialQty(e.target.value)}/></div><div className="field"><label>&nbsp;</label><button type="button" className="btn btn-secondary" onClick={addMaterial}>Adicionar material</button></div></div>
    {links.length>0&&<table><thead><tr><th>Material</th><th>Quantidade</th><th>Custo</th><th></th></tr></thead><tbody>{links.map(l=>{const m=materials.find(x=>x.id===l.material_id);return <tr key={l.material_id}><td>{m?.name}</td><td>{Number(l.quantity).toFixed(3)} {m?.unit}</td><td>{money(Number(l.quantity)*Number(m?.average_cost||0))}</td><td><button type="button" className="btn btn-danger btn-sm" onClick={()=>setLinks(x=>x.filter(a=>a.material_id!==l.material_id))}>Remover</button></td></tr>})}</tbody></table>}
    <div className="section-title"><h3>🖨️ Produção e mão de obra</h3></div>
    <div className="form-grid"><Field label="Horas de impressão FDM"><input className="input" type="number" step="0.01" min="0" value={p.filament_hours} onChange={e=>set('filament_hours',e.target.value)}/></Field><Field label="Horas de impressão em resina"><input className="input" type="number" step="0.01" min="0" value={p.resin_hours} onChange={e=>set('resin_hours',e.target.value)}/></Field><Field label="Horas de pintura"><input className="input" type="number" step="0.01" min="0" value={p.painting_hours} onChange={e=>set('painting_hours',e.target.value)}/></Field><Field label="Horas de acabamento"><input className="input" type="number" step="0.01" min="0" value={p.finishing_hours} onChange={e=>set('finishing_hours',e.target.value)}/></Field><Field label="Valor cobrado por hora"><div className="input">{money(laborHourRate)}</div></Field></div>
    <div className="section-title"><h3>⚡ Energia e depreciação</h3></div>
    <div className="form-grid"><Field label="Energia (R$/kWh)"><input className="input" type="number" step="0.01" min="0" value={p.energy_cost_kwh} onChange={e=>set('energy_cost_kwh',e.target.value)}/></Field><Field label="Potência FDM (kW)"><input className="input" type="number" step="0.001" min="0" value={p.filament_power_kw} onChange={e=>set('filament_power_kw',e.target.value)}/></Field><Field label="Potência resina (kW)"><input className="input" type="number" step="0.001" min="0" value={p.resin_power_kw} onChange={e=>set('resin_power_kw',e.target.value)}/></Field><Field label="Depreciação FDM/h"><input className="input" type="number" step="0.0001" min="0" value={p.filament_depr_hour} onChange={e=>set('filament_depr_hour',e.target.value)}/></Field><Field label="Depreciação resina/h"><input className="input" type="number" step="0.0001" min="0" value={p.resin_depr_hour} onChange={e=>set('resin_depr_hour',e.target.value)}/></Field></div>
    <div className="section-title"><h3>🎨 Outros custos e margem</h3></div>
    <div className="form-grid"><Field label="Materiais de pintura"><input className="input" type="number" step="0.01" min="0" value={p.painting_materials} onChange={e=>set('painting_materials',e.target.value)}/></Field><Field label="Embalagem"><input className="input" type="number" step="0.01" min="0" value={p.packaging_cost} onChange={e=>set('packaging_cost',e.target.value)}/></Field><Field label="Outros custos"><input className="input" type="number" step="0.01" min="0" value={p.other_cost} onChange={e=>set('other_cost',e.target.value)}/></Field><Field label="Perda/refugo (%)"><input className="input" type="number" step="0.01" min="0" value={p.loss_percent} onChange={e=>set('loss_percent',e.target.value)}/></Field><Field label="Margem desejada (%)"><input className="input" type="number" step="0.01" min="0" value={p.margin_percent} onChange={e=>set('margin_percent',e.target.value)}/></Field><Field label="Comissão marketplace (%)"><input className="input" type="number" step="0.01" min="0" value={p.marketplace_commission} onChange={e=>set('marketplace_commission',e.target.value)}/></Field></div>
    <div className="card"><h3>🧮 Resumo</h3><div className="form-grid"><p>Materiais<br/><b>{money(materialCost)}</b></p><p>Perdas<br/><b>{money(waste)}</b></p><p>Energia<br/><b>{money(energy)}</b></p><p>Depreciação<br/><b>{money(depreciation)}</b></p><p>Mão de obra<br/><b>{money(labor)}</b></p><p>Outros<br/><b>{money(extras)}</b></p><p><strong>Custo total</strong><br/><span className="value">{money(total)}</span></p><p><strong>Preço sugerido</strong><br/><span className="value">{money(suggested)}</span></p><p>Taxa marketplace<br/><b>{money(commission)}</b></p><p><strong>Lucro líquido</strong><br/><span className="value">{money(profit)}</span></p></div></div>
    <div className="actions" style={{justifyContent:'flex-end'}}><button type="button" className="btn btn-secondary" onClick={()=>setOpen(false)}>Cancelar</button><button className="btn btn-primary" disabled={busy}>{busy?'Cadastrando...':'Cadastrar produto'}</button></div>
   </form>}
 </>
}
function Field({label,children}:{label:string;children:ReactNode}){return <div className="field"><label>{label}</label>{children}</div>}
