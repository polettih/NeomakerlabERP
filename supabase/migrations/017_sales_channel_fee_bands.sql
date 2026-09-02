-- Taxas de marketplace por faixa de preço (ex.: Shopee, que cobra
-- percentuais e taxas fixas diferentes conforme o valor do produto).
-- Um canal continua podendo usar taxa fixa (fee_percent/fixed_fee, como hoje)
-- OU faixas (fee_bands) — quando fee_bands não está vazio, ele tem prioridade
-- e a taxa é escolhida automaticamente pelo valor de cada pedido.

alter table public.sales_channels
  add column if not exists fee_bands jsonb not null default '[]'::jsonb;

comment on column public.sales_channels.fee_bands is
  'Faixas de preço com taxa própria, em ordem crescente de "min". Formato: '
  '[{"min": 0, "max": 79.99, "fee_percent": 0.20, "fixed_fee": 4}, '
  '{"min": 80, "max": null, "fee_percent": 0.14, "fixed_fee": 16}]. '
  '"max": null significa "sem teto" (última faixa). Quando não vazio, tem '
  'prioridade sobre fee_percent/fixed_fee na criação de pedidos.';
