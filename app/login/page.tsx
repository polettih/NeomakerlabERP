"use client";
import {FormEvent,useState} from "react";
import {createClient} from "@/lib/supabase/client";
import {useRouter} from "next/navigation";
import Link from "next/link";

export default function LoginPage(){
  const router=useRouter(); const [email,setEmail]=useState(""); const [password,setPassword]=useState("");
  const [error,setError]=useState(""); const [loading,setLoading]=useState(false);
  async function submit(e:FormEvent){e.preventDefault();setLoading(true);setError("");
    const {error}=await createClient().auth.signInWithPassword({email,password});
    if(error)setError(error.message);else{router.push("/dashboard");router.refresh()} setLoading(false);
  }
  return <div className="login-page"><div className="login-card"><h1>NeoMaker <span style={{color:"var(--accent)"}}>ERP</span></h1>
    <p className="muted">Entre para gerenciar sua operação.</p>{error&&<p className="error">{error}</p>}
    <form onSubmit={submit} className="grid" style={{marginTop:18}}>
      <div className="field"><label>E-mail</label><input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></div>
      <div className="field"><label>Senha</label><input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} required/></div>
      <button className="btn btn-primary" disabled={loading}>{loading?"Entrando...":"Entrar"}</button>
    </form><p className="muted" style={{marginTop:18}}>Primeiro acesso? <Link href="/signup" style={{textDecoration:"underline"}}>Criar conta</Link></p>
  </div></div>;
}