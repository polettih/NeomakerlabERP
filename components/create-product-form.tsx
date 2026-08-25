"use client";
import {FormEvent,useState} from "react"; import {useRouter} from "next/navigation";
export function CreateProductForm(){
  const r=useRouter(); const [name,setName]=useState(""); const [price,setPrice]=useState(""); const [cost,setCost]=useState(""); const [error,setError]=useState("");
  async function submit(e:FormEvent){e.preventDefault();setError("");const res=await fetch("/api/products",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,sale_price:Number(price),estimated_cost:Number(cost||0)})});const j=await res.json();if(!res.ok)setError(j.error||"Erro");else{setName("");setPrice("");setCost("");r.refresh()}}
  return <form onSubmit={submit} className="card grid"><h2>Novo produto</h2>{error&&<div className="error">{error}</div>}
    <div className="field"><label>Nome</label><input className="input" value={name} onChange={e=>setName(e.target.value)} required/></div>
    <div className="field"><label>Preço de venda</label><input className="input" type="number" step="0.01" min="0" value={price} onChange={e=>setPrice(e.target.value)} required/></div>
    <div className="field"><label>Custo estimado</label><input className="input" type="number" step="0.01" min="0" value={cost} onChange={e=>setCost(e.target.value)}/></div>
    <button className="btn btn-primary">Salvar produto</button>
  </form>;
}