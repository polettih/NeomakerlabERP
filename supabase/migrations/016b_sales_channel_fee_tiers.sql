-- Faixas de taxa por valor do pedido (ex.: Shopee cobra percentuais e taxas fixas
-- diferentes dependendo do valor da mercadoria). Um canal sem linhas nesta tabela
-- continua usando sales_channels.fee_percent/fixed_fee normalmente (compatível com
-- Mercado Livre, Elo7, venda direta etc., que não têm faixas).
create table if not exists public.sales_channel_tiers(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  channel_id uuid not null references public.sales_channels(id) on delete cascade,
  min_value numeric(12,2) not null default 0,
  max_value numeric(12,2), -- null = sem teto (última faixa)
  fee_percent numeric(6,4) not null default 0,
  fixed_fee numeric(12,2) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  check (min_value >= 0),
  check (max_value is null or max_value > min_value),
  check (fee_percent >= 0 and fee_percent <= 1),
  check (fixed_fee >= 0)
);

create index if not exists sales_channel_tiers_channel_idx
  on public.sales_channel_tiers(channel_id);

alter table public.sales_channel_tiers enable row level security;

drop policy if exists sales_channel_tiers_access on public.sales_channel_tiers;
create policy sales_channel_tiers_access on public.sales_channel_tiers
  for all
  using(organization_id in (select public.get_my_organization_ids()))
  with check(organization_id in (select public.get_my_organization_ids()));
