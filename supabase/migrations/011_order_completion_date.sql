-- V12: permite registrar a data real em que um pedido foi concluído.
alter table public.orders add column if not exists completed_at timestamptz;

-- Preserva as datas de conclusão já registradas em delivered_at.
update public.orders
set completed_at = delivered_at
where completed_at is null and delivered_at is not null;

create index if not exists orders_completed_at_idx on public.orders(completed_at);
