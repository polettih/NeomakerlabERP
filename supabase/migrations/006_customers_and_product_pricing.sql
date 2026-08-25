-- V7 customers + product pricing
alter table customers add column if not exists behavior text not null default 'Normal' check (behavior in ('Excelente','Bom','Normal','Problemático','Péssimo','Bloqueado'));
alter table customers add column if not exists notes text;

create table if not exists product_pricing (
 id uuid primary key default gen_random_uuid(), product_id uuid not null unique references products(id) on delete cascade,
 filament_g numeric not null default 0, resin_ml numeric not null default 0,
 filament_hours numeric not null default 0, resin_hours numeric not null default 0,
 painting_hours numeric not null default 0, finishing_hours numeric not null default 0,
 labor_hour numeric not null default 30, painting_materials numeric not null default 0,
 packaging_cost numeric not null default 0, other_cost numeric not null default 0,
 filament_cost_per_g numeric not null default 0.09, resin_cost_per_ml numeric not null default 0.65,
 energy_cost_kwh numeric not null default 1.12, filament_power_kw numeric not null default 0.12, resin_power_kw numeric not null default 0.07,
 filament_depr_hour numeric not null default 0, resin_depr_hour numeric not null default 0,
 loss_percent numeric not null default 0.08, margin_percent numeric not null default 0.20, marketplace_commission numeric not null default 0.14,
 total_cost numeric not null default 0, suggested_price numeric not null default 0, net_after_commission numeric not null default 0, profit numeric not null default 0,
 created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table product_pricing enable row level security;
create policy "pricing org via product" on product_pricing for all using (exists(select 1 from products p where p.id=product_id and p.organization_id in (select organization_id from organization_members where user_id=auth.uid()))) with check (exists(select 1 from products p where p.id=product_id and p.organization_id in (select organization_id from organization_members where user_id=auth.uid())));
