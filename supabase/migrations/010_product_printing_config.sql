-- V10: configuração de impressão por produto e histórico preservado nos pedidos
alter table public.product_materials
  add column if not exists usage_type text not null default 'other'
  check (usage_type in ('fdm','resin','other'));

alter table public.product_pricing
  add column if not exists fdm_material_id uuid references public.materials(id) on delete set null;

alter table public.product_pricing
  add column if not exists resin_material_id uuid references public.materials(id) on delete set null;

create index if not exists product_materials_usage_idx
  on public.product_materials(product_id, usage_type);

-- Atualiza o custo/preço somente do cadastro atual do produto.
-- order_items já possui unit_price/unit_cost, portanto pedidos existentes
-- continuam com o snapshot da época da venda.


-- Tarifa de energia é uma configuração global da organização; a potência vem da impressora cadastrada.
alter table public.organization_settings
  add column if not exists energy_cost_kwh numeric(12,4) not null default 1.12
  check (energy_cost_kwh >= 0);
