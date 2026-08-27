"use client";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    const { data, error } = await createClient().auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (error) setError(error.message);
    else if (data.session) {
      router.push("/dashboard");
      router.refresh();
    } else setMessage("Conta criada. Confirme o e-mail antes de entrar.");
    setLoading(false);
  }
  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Criar conta</h1>
        <p className="muted">A organização e os canais iniciais serão criados automaticamente.</p>
        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}
        <form onSubmit={submit} className="grid" style={{ marginTop: 18 }}>
          <div className="field">
            <label>Nome</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>E-mail</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Senha</label>
            <input
              className="input"
              type="password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary" disabled={loading}>
            {loading ? "Criando..." : "Criar conta"}
          </button>
        </form>
        <p className="muted" style={{ marginTop: 18 }}>
          <Link href="/login" style={{ textDecoration: "underline" }}>
            Voltar para login
          </Link>
        </p>
      </div>
    </div>
  );
}
