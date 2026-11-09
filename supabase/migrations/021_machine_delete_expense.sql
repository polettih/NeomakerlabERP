-- Corrige: excluir uma máquina/impressora não removia a despesa de compra dela do
-- Financeiro. A função sync_machine_purchase_expense() já tratava o DELETE, mas o gatilho
-- só estava ligado a INSERT/UPDATE, então a despesa continuava "paga" depois da exclusão.
create or replace function public.cancel_machine_purchase_expense()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  update public.expenses
     set status='cancelled', updated_at=now()
   where source_type='machine_purchase' and source_id=old.id;
  return old;
end; $$;

drop trigger if exists machine_purchase_expense_delete on public.machines;
create trigger machine_purchase_expense_delete after delete on public.machines
for each row execute function public.cancel_machine_purchase_expense();

-- Limpa despesas de compra que ficaram órfãs de máquinas já excluídas antes desta correção.
update public.expenses e
   set status='cancelled', updated_at=now()
 where e.source_type='machine_purchase'
   and e.status <> 'cancelled'
   and not exists(select 1 from public.machines m where m.id = e.source_id);
