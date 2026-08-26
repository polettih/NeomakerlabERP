-- V9: valor centralizado da mão de obra por organização
create table if not exists public.organization_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  labor_hour_rate numeric(12,2) not null default 30 check(labor_hour_rate>=0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organization_settings enable row level security;
drop policy if exists organization_settings_access on public.organization_settings;
create policy organization_settings_access on public.organization_settings
for all using(organization_id in (select public.get_my_organization_ids()))
with check(organization_id in (select public.get_my_organization_ids()));

insert into public.organization_settings(organization_id,labor_hour_rate)
select o.id,30 from public.organizations o
on conflict (organization_id) do nothing;
