"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
export function CreateCustomerForm() {
  const r = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone }),
    });
    const j = await res.json();
    if (!res.ok) setError(j.error || "Erro");
    else {
      setName("");
      setEmail("");
      setPhone("");
      r.refresh();
    }
  }
  return (
    <form onSubmit={submit} className="card grid">
      <h2>Novo cliente</h2>
      {error && <div className="error">{error}</div>}
      <div className="field">
        <label>Nome</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="field">
        <label>E-mail</label>
        <input
          className="input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="field">
        <label>Telefone</label>
        <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <button className="btn btn-primary">Salvar cliente</button>
    </form>
  );
}
