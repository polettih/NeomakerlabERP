-- V8: materiais, estoque, compras, consumo automático e precificação separada
create table if not exists public.materials (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 name text not null,
 category text not null default 'Insumos' check(category in ('Ferramentas','Maquinários','Insumos')),
 unit text not null default 'un',
 quantity_on_hand numeric(14,3) not null default 0,
 minimum_stock numeric(14,3) not null default 0,
 average_cost numeric(14,4) not null default 0,
 supplier text,
 active boolean not null default true,
 notes text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(organization_id,name)
);

create table if not exists public.material_purchases (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 material_id uuid not null references public.materials(id) on delete restrict,
 quantity numeric(14,3) not null check(quantity>0),
 total_cost numeric(14,2) not null check(total_cost>=0),
 supplier text,
 purchased_at timestamptz not null default now(),
 notes text,
 created_at timestamptz not null default now()
);

create table if not exists public.stock_movements (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 material_id uuid not null references public.materials(id) on delete restrict,
 movement_type text not null check(movement_type in ('purchase','production_consumption','manual_consumption','adjustment','waste','return')),
 quantity numeric(14,3) not null check(quantity<>0),
 unit_cost numeric(14,4) not null default 0,
 product_id uuid references public.products(id) on delete set null,
 order_id uuid references public.orders(id) on delete set null,
 description text,
 created_at timestamptz not null default now()
);

create table if not exists public.product_materials (
 id uuid primary key default gen_random_uuid(),
 product_id uuid not null references public.products(id) on delete cascade,
 material_id uuid not null references public.materials(id) on delete restrict,
 quantity numeric(14,3) not null check(quantity>0),
 notes text,
 unique(product_id,material_id)
);

create table if not exists public.machines (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 name text not null,
 category text not null default 'Impressora FDM' check(category in ('Impressora FDM','Impressora Resina','Outra')),
 power_kw numeric(10,4) not null default 0,
 purchase_value numeric(12,2) not null default 0,
 useful_hours numeric(12,2) not null default 0,
 depreciation_per_hour numeric(12,6) not null default 0,
 active boolean not null default true,
 notes text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.production_material_consumption (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 production_order_id uuid not null references public.production_orders(id) on delete cascade,
 material_id uuid not null references public.materials(id) on delete restrict,
 quantity numeric(14,3) not null check(quantity>0),
 unit_cost numeric(14,4) not null default 0,
 created_at timestamptz not null default now(),
 unique(production_order_id,material_id)
);

alter table public.product_pricing add column if not exists fdm_machine_id uuid references public.machines(id) on delete set null;
alter table public.product_pricing add column if not exists resin_machine_id uuid references public.machines(id) on delete set null;
alter table public.product_pricing add column if not exists material_cost numeric not null default 0;
alter table public.product_pricing add column if not exists energy_cost numeric not null default 0;
alter table public.product_pricing add column if not exists depreciation_cost numeric not null default 0;
alter table public.product_pricing add column if not exists labor_cost numeric not null default 0;
alter table public.product_pricing add column if not exists waste_cost numeric not null default 0;

create index if not exists materials_org_idx on public.materials(organization_id);
create index if not exists stock_movements_material_idx on public.stock_movements(material_id,created_at);
create index if not exists product_materials_product_idx on public.product_materials(product_id);

alter table public.materials enable row level security;
alter table public.material_purchases enable row level security;
alter table public.stock_movements enable row level security;
alter table public.product_materials enable row level security;
alter table public.machines enable row level security;
alter table public.production_material_consumption enable row level security;

drop policy if exists materials_access on public.materials;
create policy materials_access on public.materials for all using(organization_id in (select public.get_my_organization_ids())) with check(organization_id in (select public.get_my_organization_ids()));
drop policy if exists purchases_access on public.material_purchases;
create policy purchases_access on public.material_purchases for all using(organization_id in (select public.get_my_organization_ids())) with check(organization_id in (select public.get_my_organization_ids()));
drop policy if exists movements_access on public.stock_movements;
create policy movements_access on public.stock_movements for all using(organization_id in (select public.get_my_organization_ids())) with check(organization_id in (select public.get_my_organization_ids()));
drop policy if exists product_materials_access on public.product_materials;
create policy product_materials_access on public.product_materials for all using(product_id in (select id from public.products where organization_id in (select public.get_my_organization_ids()))) with check(product_id in (select id from public.products where organization_id in (select public.get_my_organization_ids())));
drop policy if exists machines_access on public.machines;
create policy machines_access on public.machines for all using(organization_id in (select public.get_my_organization_ids())) with check(organization_id in (select public.get_my_organization_ids()));
drop policy if exists production_consumption_access on public.production_material_consumption;
create policy production_consumption_access on public.production_material_consumption for all using(organization_id in (select public.get_my_organization_ids())) with check(organization_id in (select public.get_my_organization_ids()));

create or replace function public.register_material_purchase(p_material uuid,p_quantity numeric,p_total numeric,p_supplier text,p_notes text)
returns void language plpgsql security definer set search_path=public as $$
declare org uuid; old_qty numeric; old_avg numeric; new_avg numeric;
begin
 select organization_id,quantity_on_hand,average_cost into org,old_qty,old_avg from public.materials where id=p_material for update;
 if org is null then raise exception 'Material não encontrado.'; end if;
 if org not in (select public.get_my_organization_ids()) then raise exception 'Acesso negado.'; end if;
 new_avg:=case when old_qty+p_quantity=0 then 0 else ((old_qty*old_avg)+p_total)/(old_qty+p_quantity) end;
 update public.materials set quantity_on_hand=old_qty+p_quantity,average_cost=new_avg,supplier=coalesce(nullif(p_supplier,''),supplier),updated_at=now() where id=p_material;
 insert into public.material_purchases(organization_id,material_id,quantity,total_cost,supplier,notes) values(org,p_material,p_quantity,p_total,p_supplier,p_notes);
 insert into public.stock_movements(organization_id,material_id,movement_type,quantity,unit_cost,description) values(org,p_material,'purchase',p_quantity,case when p_quantity=0 then 0 else p_total/p_quantity end,coalesce(p_notes,'Compra de material'));
end; $$;

create or replace function public.consume_production_materials()
returns trigger language plpgsql security definer set search_path=public as $$
declare oi record; pm record; need numeric; current_qty numeric; org uuid;
begin
 if new.status='in_progress' and old.status is distinct from 'in_progress' then
   if exists(select 1 from public.production_material_consumption where production_order_id=new.id) then return new; end if;
   org:=new.organization_id;
   for pm in
     select pm.material_id,sum(pm.quantity*oi.quantity)::numeric as qty
     from public.order_items oi join public.product_materials pm on pm.product_id=oi.product_id
     where oi.order_id=new.order_id group by pm.material_id
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
drop trigger if exists production_auto_stock on public.production_orders;
create trigger production_auto_stock after update of status on public.production_orders for each row execute function public.consume_production_materials();
