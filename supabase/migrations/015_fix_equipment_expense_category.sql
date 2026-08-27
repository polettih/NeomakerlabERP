-- V17 (bugfix): a despesa gerada automaticamente na compra de uma
-- máquina/impressora usava a categoria "Equipamentos" (plural), mas a lista
-- de categorias do app (lib/expense-categories.ts) só reconhece
-- "Equipamento" (singular). Resultado: ao editar essa despesa em
-- Gastos e Compras, o campo categoria aparecia em branco, porque o valor
-- salvo não batia com nenhuma opção do <select>.
--
-- Este script:
--   1) corrige a função/trigger para gravar sempre "Equipamento";
--   2) corrige o backfill de máquinas já existentes;
--   3) corrige registros já gravados com a categoria antiga.

create or replace function public.sync_machine_purchase_expense()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='DELETE' then
    update public.expenses set status='cancelled' where source_type='machine_purchase' and source_id=old.id;
    return old;
  end if;
  if new.purchase_value is not null and new.purchase_value > 0 then
    insert into public.expenses(organization_id,description,category,amount,status,due_date,source_type,source_id)
    values(new.organization_id, 'Compra de equipamento: '||new.name, 'Equipamento', new.purchase_value, 'paid', coalesce(new.purchase_date,current_date), 'machine_purchase', new.id)
    on conflict (source_id) where source_type='machine_purchase' and source_id is not null
    do update set description=excluded.description, category=excluded.category, amount=excluded.amount,
      due_date=excluded.due_date, status='paid', updated_at=now();
  else
    update public.expenses set status='cancelled' where source_type='machine_purchase' and source_id=new.id;
  end if;
  return new;
end; $$;

-- Corrige despesas de compra de equipamento já gravadas com a categoria antiga.
update public.expenses
set category = 'Equipamento'
where source_type = 'machine_purchase' and category = 'Equipamentos';
