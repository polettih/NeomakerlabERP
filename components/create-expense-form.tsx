"use client";
import {FormEvent,useState} from "react"; import {useRouter} from "next/navigation";
export function CreateExpenseForm(){
  const r=useRouter(); const [description,setDescription]=useState(""); const [category,setCategory]=useState(""); const [amount,setAmount]=useState(""); const [error,setError]=useState("");
  async function submit(e:FormEvent){e.preventDefault();setError("");const res=await fetch("/api/expenses",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({description,category,amount:Number(amount)})});const j=await res.json();if(!res.ok)setError(j.error||"Erro");else{setDescription("");setCategory("");setAmount("");r.refresh()}}
  return <form onSubmit={submit} className="card grid"><h2>Nova despesa</h2>{error&&<div className="error">{error}</div>}
    <div className="field"><label>Descrição</label><input className="input" value={description} onChange={e=>setDescription(e.target.value)} required/></div>
    <div className="field"><label>Categoria</label><input className="input" value={category} onChange={e=>setCategory(e.target.value)}/></div>
    <div className="field"><label>Valor</label><input className="input" type="number" step="0.01" min="0.01" value={amount} onChange={e=>setAmount(e.target.value)} required/></div>
    <button className="btn btn-primary">Salvar despesa</button>
  </form>;
}