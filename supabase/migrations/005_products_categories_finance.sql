-- V5: categorias de produtos e limite de 8 fotos por produto
alter table public.products add column if not exists category text not null default 'Bonecos';
create index if not exists products_category_idx on public.products(category);

-- Garante no banco que um produto não ultrapasse 8 imagens.
create or replace function public.enforce_product_image_limit() returns trigger
language plpgsql security definer set search_path=public as $$
declare total integer;
begin
  select count(*) into total from public.product_images where product_id=new.product_id;
  if total >= 8 then raise exception 'Um produto pode ter no máximo 8 fotos.'; end if;
  return new;
end; $$;
drop trigger if exists product_image_limit on public.product_images;
create trigger product_image_limit before insert on public.product_images for each row execute function public.enforce_product_image_limit();
