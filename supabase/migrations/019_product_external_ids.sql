-- Guarda o(s) ID(s) do produto nos marketplaces (Shopee, Mercado Livre, TikTok Shop...)
-- para permitir reimportar a mesma planilha (ou uma planilha mais nova) sem duplicar
-- produtos já cadastrados. Formato: {"shopee": "58267452292", "mercado_livre": "...", "tiktok_shop": "..."}
alter table public.products
  add column if not exists external_ids jsonb not null default '{}'::jsonb;

create index if not exists products_external_ids_idx on public.products using gin(external_ids);
