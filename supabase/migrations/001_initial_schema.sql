create extension if not exists "pgcrypto";

do $$ begin create type public.member_role as enum ('owner','admin','operator','viewer'); exception when duplicate_object then null; end $$;
do $$ begin create type public.customer_type as enum ('person','company'); exception when duplicate_object then null; end $$;
do $$ begin create type public.order_status as enum ('new','preparation','production','finishing','packaging','shipped','delivered','cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type public.payment_status as enum ('pending','partial','paid','refunded','cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type public.payment_method as enum ('pix','cash','credit_card','debit_card','bank_transfer','marketplace','other'); exception when duplicate_object then null; end $$;
do $$ begin create type public.expense_status as enum ('pending','paid','cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type public.production_status as enum ('pending','in_progress','completed','cancelled'); exception when duplicate_object then null; end $$;

create table if not exists public.organizations(id uuid primary key default gen_random_uuid(),name text not null,document text,email text,phone text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.organization_members(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,role public.member_role not null default 'viewer',created_at timestamptz not null default now(),unique(organization_id,user_id));
create table if not exists public.customers(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,name text not null,customer_type public.customer_type not null default 'person',document text,email text,phone text,notes text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.sales_channels(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,name text not null,active boolean not null default true,created_at timestamptz not null default now(),unique(organization_id,name));
create table if not exists public.products(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,name text not null,sku text,description text,sale_price numeric(12,2) not null default 0,estimated_cost numeric(12,2) not null default 0,active boolean not null default true,image_url text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(organization_id,sku));
create table if not exists public.orders(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,customer_id uuid references public.customers(id) on delete set null,sales_channel_id uuid references public.sales_channels(id) on delete set null,external_order_id text,status public.order_status not null default 'new',payment_status public.payment_status not null default 'pending',order_date timestamptz not null default now(),expected_date timestamptz,shipped_at timestamptz,delivered_at timestamptz,subtotal numeric(12,2) not null default 0,discount numeric(12,2) not null default 0,shipping_cost numeric(12,2) not null default 0,marketplace_fee numeric(12,2) not null default 0,total numeric(12,2) not null default 0,notes text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.order_items(id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id) on delete cascade,product_id uuid references public.products(id) on delete set null,product_name text not null,quantity integer not null default 1,unit_price numeric(12,2) not null default 0,unit_cost numeric(12,2) not null default 0,discount numeric(12,2) not null default 0,total numeric(12,2) not null default 0,created_at timestamptz not null default now(),check(quantity>0));
create table if not exists public.payments(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,order_id uuid references public.orders(id) on delete set null,description text,amount numeric(12,2) not null,payment_method public.payment_method not null,payment_date timestamptz not null default now(),notes text,created_at timestamptz not null default now(),check(amount>0));
create table if not exists public.expenses(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,description text not null,category text,amount numeric(12,2) not null,due_date date,paid_at timestamptz,status public.expense_status not null default 'pending',notes text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(amount>0));
create table if not exists public.order_status_history(id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id) on delete cascade,old_status public.order_status,new_status public.order_status not null,changed_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now());
create table if not exists public.production_orders(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,order_id uuid not null references public.orders(id) on delete cascade,status public.production_status not null default 'pending',priority integer not null default 0,started_at timestamptz,completed_at timestamptz,notes text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(order_id));

create index if not exists customers_organization_idx on public.customers(organization_id);
create index if not exists products_organization_idx on public.products(organization_id);
create index if not exists orders_organization_idx on public.orders(organization_id);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_order_date_idx on public.orders(order_date);
create index if not exists payments_organization_idx on public.payments(organization_id);
create index if not exists expenses_organization_idx on public.expenses(organization_id);
create index if not exists production_orders_status_idx on public.production_orders(status);

create or replace function public.update_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists organizations_updated_at on public.organizations; create trigger organizations_updated_at before update on public.organizations for each row execute function public.update_updated_at();
drop trigger if exists customers_updated_at on public.customers; create trigger customers_updated_at before update on public.customers for each row execute function public.update_updated_at();
drop trigger if exists products_updated_at on public.products; create trigger products_updated_at before update on public.products for each row execute function public.update_updated_at();
drop trigger if exists orders_updated_at on public.orders; create trigger orders_updated_at before update on public.orders for each row execute function public.update_updated_at();
drop trigger if exists expenses_updated_at on public.expenses; create trigger expenses_updated_at before update on public.expenses for each row execute function public.update_updated_at();
drop trigger if exists production_orders_updated_at on public.production_orders; create trigger production_orders_updated_at before update on public.production_orders for each row execute function public.update_updated_at();

create or replace function public.get_my_organization_ids() returns setof uuid language sql security definer set search_path=public stable as $$ select organization_id from public.organization_members where user_id=auth.uid(); $$;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.customers enable row level security;
alter table public.sales_channels enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;
alter table public.order_status_history enable row level security;
alter table public.production_orders enable row level security;

drop policy if exists organizations_access on public.organizations;
create policy organizations_access on public.organizations for all using(id in (select public.get_my_organization_ids())) with check(id in (select public.get_my_organization_ids()));

drop policy if exists members_self on public.organization_members;
create policy members_self on public.organization_members for select using(user_id=auth.uid());

drop policy if exists customers_access on public.customers;
create policy customers_access on public.customers for all using(organization_id in (select public.get_my_organization_ids())) with check(organization_id in (select public.get_my_organization_ids()));

drop policy if exists channels_access on public.sales_channels;
create policy channels_access on public.sales_channels for all using(organization_id in (select public.get_my_organization_ids())) with check(organization_id in (select public.get_my_organization_ids()));

drop policy if exists products_access on public.products;
create policy products_access on public.products for all using(organization_id in (select public.get_my_organization_ids())) with check(organization_id in (select public.get_my_organization_ids()));

drop policy if exists orders_access on public.orders;
create policy orders_access on public.orders for all using(organization_id in (select public.get_my_organization_ids())) with check(organization_id in (select public.get_my_organization_ids()));

drop policy if exists payments_access on public.payments;
create policy payments_access on public.payments for all using(organization_id in (select public.get_my_organization_ids())) with check(organization_id in (select public.get_my_organization_ids()));

drop policy if exists expenses_access on public.expenses;
create policy expenses_access on public.expenses for all using(organization_id in (select public.get_my_organization_ids())) with check(organization_id in (select public.get_my_organization_ids()));

drop policy if exists production_access on public.production_orders;
create policy production_access on public.production_orders for all using(organization_id in (select public.get_my_organization_ids())) with check(organization_id in (select public.get_my_organization_ids()));

drop policy if exists order_items_access on public.order_items;
create policy order_items_access on public.order_items for all using(order_id in (select id from public.orders where organization_id in (select public.get_my_organization_ids()))) with check(order_id in (select id from public.orders where organization_id in (select public.get_my_organization_ids())));

drop policy if exists status_history_access on public.order_status_history;
create policy status_history_access on public.order_status_history for all using(order_id in (select id from public.orders where organization_id in (select public.get_my_organization_ids()))) with check(order_id in (select id from public.orders where organization_id in (select public.get_my_organization_ids())));

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
declare org_id uuid; display_name text;
begin
  display_name:=coalesce(new.raw_user_meta_data->>'full_name','Minha empresa');
  insert into public.organizations(name) values(display_name || ' - NeoMaker ERP') returning id into org_id;
  insert into public.organization_members(organization_id,user_id,role) values(org_id,new.id,'owner');
  insert into public.sales_channels(organization_id,name) values(org_id,'Shopee'),(org_id,'TikTok Shop'),(org_id,'Instagram'),(org_id,'Venda direta');
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();