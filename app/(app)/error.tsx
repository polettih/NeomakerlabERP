"use client";

/** Erro inesperado em qualquer tela do sistema: mostra uma saída em vez de tela em branco. */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="content" role="alert">
      <div className="card">
        <h2>Algo deu errado</h2>
        <p className="muted">
          {error.message || "Não foi possível carregar esta tela."} Se o problema persistir, confira
          se o projeto do Supabase está ativo (projetos gratuitos pausam por inatividade).
        </p>
        <button type="button" className="btn btn-primary" onClick={reset}>
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
