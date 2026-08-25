create table if not exists public.product_images(
 id uuid primary key default gen_random_uuid(),
 product_id uuid not null references public.products(id) on delete cascade,
 organization_id uuid not null references public.organizations(id) on delete cascade,
 storage_path text not null,
 public_url text not null,
 sort_order integer not null default 0,
 created_at timestamptz not null default now()
);
create index if not exists product_images_product_idx on public.product_images(product_id);
alter table public.product_images enable row level security;
drop policy if exists product_images_access on public.product_images;
create policy product_images_access on public.product_images for all using(organization_id in (select public.get_my_organization_ids())) with check(organization_id in (select public.get_my_organization_ids()));

create table if not exists public.painting_revenues(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 description text not null,
 customer_name text,
 amount numeric(12,2) not null,
 painting_date timestamptz not null default now(),
 status text not null default 'received',
 notes text,
 created_at timestamptz not null default now(),
 check(amount>0)
);
create index if not exists painting_revenues_org_idx on public.painting_revenues(organization_id);
alter table public.painting_revenues enable row level security;
drop policy if exists painting_revenues_access on public.painting_revenues;
create policy painting_revenues_access on public.painting_revenues for all using(organization_id in (select public.get_my_organization_ids())) with check(organization_id in (select public.get_my_organization_ids()));

insert into storage.buckets(id,name,public) values('product-images','product-images',true) on conflict (id) do update set public=true;
drop policy if exists product_images_public_read on storage.objects;
create policy product_images_public_read on storage.objects for select using(bucket_id='product-images');
drop policy if exists product_images_authenticated_insert on storage.objects;
create policy product_images_authenticated_insert on storage.objects for insert to authenticated with check(bucket_id='product-images');
drop policy if exists product_images_authenticated_update on storage.objects;
create policy product_images_authenticated_update on storage.objects for update to authenticated using(bucket_id='product-images') with check(bucket_id='product-images');
drop policy if exists product_images_authenticated_delete on storage.objects;
create policy product_images_authenticated_delete on storage.objects for delete to authenticated using(bucket_id='product-images');
