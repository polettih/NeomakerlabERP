-- V13: estoque e gastos/compras unificados; tipos, unidades e cores de materiais
alter table public.materials
  add column if not exists material_type text not null default 'Outro';

alter table public.materials
  add column if not exists color_name text;

alter table public.materials
  add column if not exists color_hex text;

alter table public.materials
  drop constraint if exists materials_material_type_check;

alter table public.materials
  add constraint materials_material_type_check
  check (material_type in ('Filamento','Resina','Outro'));

alter table public.materials
  drop constraint if exists materials_color_hex_check;

alter table public.materials
  add constraint materials_color_hex_check
  check (color_hex is null or color_hex ~ '^#[0-9A-Fa-f]{6}$');

create index if not exists materials_type_color_idx
  on public.materials(organization_id, material_type, color_name);

-- Novos materiais de filamento usam gramas e resinas usam ml.
-- Materiais existentes permanecem intactos para não alterar custos históricos.
-- O cadastro da V13 passa a gravar os novos itens nas unidades padronizadas.

create or replace function public.register_material_purchase(
  p_material uuid,
  p_quantity numeric,
  p_total numeric,
  p_supplier text,
  p_notes text
)
returns void language plpgsql security definer set search_path=public as $$
declare
  org uuid;
  old_qty numeric;
  old_avg numeric;
  new_avg numeric;
begin
  select organization_id, quantity_on_hand, average_cost
    into org, old_qty, old_avg
  from public.materials
  where id=p_material
  for update;

  if org is null then raise exception 'Material não encontrado.'; end if;
  if org not in (select public.get_my_organization_ids()) then raise exception 'Acesso negado.'; end if;
  if p_quantity <= 0 then raise exception 'A quantidade da compra deve ser maior que zero.'; end if;
  if p_total < 0 then raise exception 'O valor da compra não pode ser negativo.'; end if;

  new_avg := case when old_qty+p_quantity=0 then 0
    else ((old_qty*old_avg)+p_total)/(old_qty+p_quantity) end;

  update public.materials
    set quantity_on_hand=old_qty+p_quantity,
        average_cost=new_avg,
        supplier=coalesce(nullif(p_supplier,''),supplier),
        updated_at=now()
  where id=p_material;

  insert into public.material_purchases(organization_id,material_id,quantity,total_cost,supplier,notes)
  values(org,p_material,p_quantity,p_total,p_supplier,p_notes);

  insert into public.stock_movements(organization_id,material_id,movement_type,quantity,unit_cost,description)
  values(org,p_material,'purchase',p_quantity,case when p_quantity=0 then 0 else p_total/p_quantity end,coalesce(p_notes,'Compra de material'));
end; $$;
