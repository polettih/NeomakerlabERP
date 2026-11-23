-- Calculadora de custo do produto: guarda o modelo completo (gramas/ml manuais, horas,
-- valor da hora, perdas, margem e o custo manual, se houver) para poder reabrir e alterar
-- o cálculo depois. Produtos antigos continuam funcionando sem ele (cost_model nulo).
alter table public.product_pricing
  add column if not exists cost_model jsonb;
