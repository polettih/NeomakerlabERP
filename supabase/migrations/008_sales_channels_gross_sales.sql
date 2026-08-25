-- V9: channel fees, gross sales, order deletion/stock restoration support
alter table public.sales_channels add column if not exists fee_percent numeric(8,4) not null default 0 check(fee_percent>=0 and fee_percent<=1);
alter table public.sales_channels add column if not exists fixed_fee numeric(12,2) not null default 0 check(fixed_fee>=0);
alter table public.orders add column if not exists gross_total numeric(12,2) not null default 0;
alter table public.orders add column if not exists marketplace_fee_percent numeric(8,4) not null default 0;
alter table public.orders add column if not exists marketplace_fixed_fee numeric(12,2) not null default 0;

update public.orders set gross_total=coalesce(nullif(total,0),subtotal-discount+shipping_cost) where gross_total=0;

create or replace function public.delete_order_with_stock_restore(p_order uuid)
returns void language plpgsql security definer set search_path=public as $$
declare org uuid; c record;
begin
  select organization_id into org from public.orders where id=p_order;
  if org is null then raise exception 'Pedido não encontrado.'; end if;
  if org not in (select public.get_my_organization_ids()) then raise exception 'Acesso negado.'; end if;

  for c in
    select pmc.material_id, sum(pmc.quantity) qty, max(pmc.unit_cost) unit_cost
    from public.production_material_consumption pmc
    join public.production_orders po on po.id=pmc.production_order_id
    where po.order_id=p_order
    group by pmc.material_id
  loop
    update public.materials set quantity_on_hand=quantity_on_hand+c.qty, updated_at=now() where id=c.material_id;
    insert into public.stock_movements(organization_id,material_id,movement_type,quantity,unit_cost,order_id,description)
      values(org,c.material_id,'return',c.qty,c.unit_cost,p_order,'Estorno automático pela exclusão do pedido');
  end loop;

  delete from public.payments where order_id=p_order;
  delete from public.orders where id=p_order;
end; $$;
