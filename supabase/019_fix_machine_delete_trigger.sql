-- Corrige um bug que já existia desde a criação do recurso (migration 013):
-- a função sync_machine_purchase_expense() já sabia cancelar a despesa
-- vinculada quando uma máquina era excluída (bloco "if tg_op='DELETE'"),
-- mas o gatilho nunca foi registrado para o evento DELETE — só para
-- INSERT e UPDATE. Ou seja, esse bloco nunca rodava de verdade: excluir uma
-- máquina nunca cancelava a despesa de compra dela, que ficava contando
-- para sempre no Financeiro e no Início.

drop trigger if exists machine_purchase_expense on public.machines;
create trigger machine_purchase_expense
after insert or update of name, purchase_value, purchase_date, organization_id or delete
on public.machines
for each row execute function public.sync_machine_purchase_expense();

-- Conserto retroativo: cancela a despesa de qualquer máquina que já foi
-- excluída antes desta correção (inclusive a impressora que você já apagou).
update public.expenses e
set status = 'cancelled'
where e.source_type = 'machine_purchase'
  and e.status = 'paid'
  and not exists (select 1 from public.machines m where m.id = e.source_id);
