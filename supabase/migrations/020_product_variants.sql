-- Variações de produto (como na Shopee): um mesmo produto pode ter várias variações,
-- cada uma com nome, SKU, preço de venda e, opcionalmente, custo próprio.
--   units         = quantas "peças base" a variação consome (ex.: "2 unidades" = 2).
--   cost_override = custo fixo da variação; se nulo, custo = estimated_cost do produto × units.
-- Produtos sem variações continuam funcionando exatamente como antes.
create table if not exists public.product_variants(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  sku text,
  sale_price numeric(12,2) not null default 0 check (sale_price >= 0),
  units numeric(10,2) not null default 1 check (units > 0),
  cost_override numeric(12,2) check (cost_override is null or cost_override >= 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  external_ids jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id, name)
);

create index if not exists product_variants_product_idx on public.product_variants(product_id);
create index if not exists product_variants_org_sku_idx on public.product_variants(organization_id, sku);

alter table public.product_variants enable row level security;
drop policy if exists product_variants_access on public.product_variants;
create policy product_variants_access on public.product_variants
  for all
  using(organization_id in (select public.get_my_organization_ids()))
  with check(organization_id in (select public.get_my_organization_ids()));

-- Guarda no item do pedido qual variação foi vendida (e o nome, para o histórico não
-- se perder se a variação for apagada depois).
alter table public.order_items
  add column if not exists variant_id uuid references public.product_variants(id) on delete set null,
  add column if not exists variant_name text;

-- Consumo automático de estoque: igual ao da migration 018, mas multiplica pela
-- quantidade de "unidades" da variação vendida (sem variação = 1).
create or replace function public.consume_production_materials()
returns trigger language plpgsql security definer set search_path=public as $$
declare pm record; org uuid; current_qty numeric;
begin
  if new.status='in_progress' and old.status is distinct from 'in_progress' then
    if exists(select 1 from public.production_material_consumption where production_order_id=new.id) then return new; end if;
    org:=new.organization_id;
    for pm in
      select mat.material_id, sum(mat.qty)::numeric as qty
      from (
        select oim.material_id, oim.quantity * oi.quantity * coalesce(pv.units,1) as qty
        from public.order_items oi
        join public.order_item_materials oim on oim.order_item_id = oi.id
        left join public.product_variants pv on pv.id = oi.variant_id
        where oi.order_id = new.order_id
        union all
        select pmt.material_id, pmt.quantity * oi.quantity * coalesce(pv.units,1) as qty
        from public.order_items oi
        join public.product_materials pmt on pmt.product_id = oi.product_id
        left join public.product_variants pv on pv.id = oi.variant_id
        where oi.order_id = new.order_id
          and not exists(select 1 from public.order_item_materials x where x.order_item_id = oi.id)
      ) mat
      group by mat.material_id
    loop
      select quantity_on_hand into current_qty from public.materials where id=pm.material_id for update;
      if current_qty is null then raise exception 'Material não encontrado.'; end if;
      if current_qty < pm.qty then
        raise exception 'Estoque insuficiente para %: disponível %, necessário %', (select name from public.materials where id=pm.material_id), current_qty, pm.qty;
      end if;
      insert into public.production_material_consumption(organization_id,production_order_id,material_id,quantity,unit_cost)
        values(org,new.id,pm.material_id,pm.qty,(select average_cost from public.materials where id=pm.material_id));
      insert into public.stock_movements(organization_id,material_id,movement_type,quantity,unit_cost,order_id,description)
        values(org,pm.material_id,'production_consumption',-pm.qty,(select average_cost from public.materials where id=pm.material_id),new.order_id,'Consumo automático da produção');
      update public.materials set quantity_on_hand=quantity_on_hand-pm.qty,updated_at=now() where id=pm.material_id;
    end loop;
  end if;
  return new;
end; $$;
