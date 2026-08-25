"use client";
import {useState} from "react"; import {useRouter} from "next/navigation";
const statuses=[['new','Novo'],['preparation','Preparação'],['production','Produção'],['finishing','Acabamento'],['packaging','Embalagem'],['shipped','Enviado'],['delivered','Finalizado'],['cancelled','Cancelado']];
export function OrderStatusActions({id,status}:{id:string;status:string}){const [value,setValue]=useState(status);const [busy,setBusy]=useState(false);const r=useRouter();
 async function save(v=value){setBusy(true);const res=await fetch(`/api/orders/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:v})});const j=await res.json();setBusy(false);if(!res.ok){alert(j.error||"Erro");setValue(status)}else r.refresh()}
 return <select className="select status-select" value={value} disabled={busy} onChange={e=>{const v=e.target.value;setValue(v);if(confirm(`Alterar o pedido para “${statuses.find(s=>s[0]===v)?.[1]}”?`))save(v);else setValue(status)}}>{statuses.map(s=><option key={s[0]} value={s[0]}>{s[1]}</option>)}</select>}
