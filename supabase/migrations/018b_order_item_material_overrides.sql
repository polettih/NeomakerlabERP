-- Permite que um único produto (ex.: "Boneco X") seja vendido com filamentos ou
-- resinas diferentes conforme a variação de cor escolhida em cada pedido, sem precisar
-- cadastrar um produto separado por cor. Se não houver override para o item, o
-- consumo de estoque continua usando os materiais padrão do produto (product_materials),
-- então pedidos antigos e produtos sem variação seguem funcionando sem nenhuma mudança.
create table if not exists public.order_item_materials(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete restrict,
  quantity numeric(14,3) not null check(quantity > 0),
  usage_type text not null default 'other' check (usage_type in ('fdm','resin','other')),
  created_at timestamptz not null default now()
);

create index if not exists order_item_materials_item_idx
  on public.order_item_materials(order_item_id);

alter table public.order_item_materials enable row level security;

drop policy if exists order_item_materials_access on public.order_item_materials;
create policy order_item_materials_access on public.order_item_materials
  for all
  using(organization_id in (select public.get_my_organization_ids()))
  with check(organization_id in (select public.get_my_organization_ids()));

-- Substitui o gatilho de consumo automático: para cada item do pedido, usa os
-- materiais registrados em order_item_materials quando existirem (a venda real,
-- inclusive variações de cor); quando não existirem, cai no comportamento antigo
-- (product_materials do produto).
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
        -- Itens com override (venda real registrada, inclusive variação de cor)
        select oim.material_id, oim.quantity * oi.quantity as qty
        from public.order_items oi
        join public.order_item_materials oim on oim.order_item_id = oi.id
        where oi.order_id = new.order_id
        union all
        -- Itens sem override: cai nos materiais padrão do produto
        select pmt.material_id, pmt.quantity * oi.quantity as qty
        from public.order_items oi
        join public.product_materials pmt on pmt.product_id = oi.product_id
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
