/**
 * Extrai uma mensagem de erro segura de um valor `unknown` (o tipo real de
 * qualquer `catch`). Evita `catch (e: any)` espalhado pelas rotas de API.
 */
export function errorMessage(e: unknown, fallback = "Erro interno"): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === "string" && e) return e;
  // Erros do Supabase/PostgREST são objetos simples ({ message, details, hint }), não Error.
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return fallback;
}
