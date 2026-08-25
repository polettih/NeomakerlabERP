"use client";
import {FormEvent,useMemo,useState} from "react"; import {useRouter} from "next/navigation";
type P={id:string;name:string;sale_price:number;estimated_cost:number;category?:string;product_images?:{public_url:string;sort_order:number}[]}; type C={id:string;name:string}; type Ch={id:string;name:string};
export function CreateOrderForm({customers,products,channels}:{customers:C[];products:P[];channels:Ch[]}){
  const r=useRouter(); const [customer,setCustomer]=useState(""); const [channel,setChannel]=useState(""); const [product,setProduct]=useState(products[0]?.id||"");
  const [qty,setQty]=useState(1); const [discount,setDiscount]=useState(0); const [shipping,setShipping]=useState(0); const [fee,setFee]=useState(0); const [error,setError]=useState("");
  const selected=products.find(p=>p.id===product); const total=useMemo(()=>Math.max((selected?.sale_price||0)*qty-discount+shipping,0),[selected,qty,discount,shipping]);
  async function submit(e:FormEvent){e.preventDefault();setError("");const res=await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({customer_id:customer||null,sales_channel_id:channel||null,discount,shipping_cost:shipping,marketplace_fee:fee,items:[{product_id:product,quantity:qty}]})});const j=await res.json();if(!res.ok)setError(j.error||"Erro");else r.push("/pedidos")}
  return <form onSubmit={submit} className="card grid" style={{maxWidth:900}}>{error&&<div className="error">{error}</div>}
    <div className="form-grid">
      <div className="field"><label>Cliente</label><select className="select" value={customer} onChange={e=>setCustomer(e.target.value)}><option value="">Sem cliente</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      <div className="field"><label>Canal</label><select className="select" value={channel} onChange={e=>setChannel(e.target.value)}><option value="">Venda direta</option>{channels.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      <div className="field"><label>Produto</label><select className="select" value={product} onChange={e=>setProduct(e.target.value)}>{products.map(p=><option key={p.id} value={p.id}>{p.name} — R$ {Number(p.sale_price).toFixed(2)}</option>)}</select>{selected?.product_images?.length ? <div className="product-preview"><img className="product-thumb" src={[...selected.product_images].sort((a,b)=>a.sort_order-b.sort_order)[0].public_url} alt=""/><div><strong>{selected.name}</strong><div className="muted">{selected.category||"Bonecos"}</div></div></div> : null}</div>
      <div className="field"><label>Quantidade</label><input className="input" type="number" min="1" value={qty} onChange={e=>setQty(Number(e.target.value))}/></div>
      <div className="field"><label>Desconto</label><input className="input" type="number" step="0.01" min="0" value={discount} onChange={e=>setDiscount(Number(e.target.value))}/></div>
      <div className="field"><label>Frete/custo</label><input className="input" type="number" step="0.01" min="0" value={shipping} onChange={e=>setShipping(Number(e.target.value))}/></div>
      <div className="field"><label>Taxa marketplace</label><input className="input" type="number" step="0.01" min="0" value={fee} onChange={e=>setFee(Number(e.target.value))}/></div>
    </div>
    <div className="card" style={{background:"#0f1318"}}><div className="label">Total calculado</div><div className="value">R$ {total.toFixed(2)}</div></div>
    <button className="btn btn-primary">Criar pedido</button>
  </form>;
}