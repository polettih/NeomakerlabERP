-- V16: equipment integrated with expenses + editable/deletable inventory + financial result
alter table public.expenses add column if not exists source_type text;
alter table public.expenses add column if not exists source_id uuid;
create index if not exists expenses_source_idx on public.expenses(organization_id, source_type, source_id);

alter table public.machines drop constraint if exists machines_category_check;
alter table public.machines add constraint machines_category_check check (category in ('Impressora FDM','Impressora Resina','Maquinário'));
alter table public.machines add column if not exists purchase_date date;

-- Keep equipment purchases linked to exactly one expense record.
create unique index if not exists expenses_machine_purchase_unique
on public.expenses(source_id) where source_type='machine_purchase' and source_id is not null;

create or replace function public.sync_machine_purchase_expense()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='DELETE' then
    update public.expenses set status='cancelled' where source_type='machine_purchase' and source_id=old.id;
    return old;
  end if;
  if new.purchase_value is not null and new.purchase_value > 0 then
    insert into public.expenses(organization_id,description,category,amount,status,due_date,source_type,source_id)
    values(new.organization_id, 'Compra de equipamento: '||new.name, 'Equipamentos', new.purchase_value, 'paid', coalesce(new.purchase_date,current_date), 'machine_purchase', new.id)
    on conflict (source_id) where source_type='machine_purchase' and source_id is not null
    do update set description=excluded.description, category=excluded.category, amount=excluded.amount,
      due_date=excluded.due_date, status='paid', updated_at=now();
  else
    update public.expenses set status='cancelled' where source_type='machine_purchase' and source_id=new.id;
  end if;
  return new;
end; $$;

drop trigger if exists machine_purchase_expense on public.machines;
create trigger machine_purchase_expense after insert or update of name,purchase_value,purchase_date,organization_id on public.machines
for each row execute function public.sync_machine_purchase_expense();

-- Existing machines are brought into the expense ledger once.
insert into public.expenses(organization_id,description,category,amount,status,due_date,source_type,source_id)
select m.organization_id,'Compra de equipamento: '||m.name,'Equipamentos',m.purchase_value,'paid',coalesce(m.purchase_date,current_date),'machine_purchase',m.id
from public.machines m
where coalesce(m.purchase_value,0)>0
and not exists(select 1 from public.expenses e where e.source_type='machine_purchase' and e.source_id=m.id);

-- Helpful indexes for cash/result calculations.
create index if not exists material_purchases_org_date_idx on public.material_purchases(organization_id, created_at);
create index if not exists orders_org_date_idx on public.orders(organization_id, order_date);
create index if not exists payments_order_date_idx on public.payments(order_id, payment_date);

-- Safe material deactivation is the supported delete semantics so historical costs remain intact.
