-- V17: despesas recorrentes, marcação de pagamento/edição/exclusão e categorias fixas.

-- Categoria fixa de despesa (mantém texto livre no banco, mas valida contra uma lista
-- conhecida na aplicação; aqui só documentamos as categorias oficiais via comentário).
comment on column public.expenses.category is
  'Categoria da despesa. Use uma das opções em lib/expense-categories.ts (Material, Frete, Marketing, Assinaturas e Software, Equipamento, Impostos e Taxas, Aluguel e Infraestrutura, Embalagem, Manutenção, Outros).';

-- Marca a competência (mês) para a qual uma despesa recorrente foi gerada, evitando duplicidade.
alter table public.expenses add column if not exists generated_period date;

create unique index if not exists expenses_recurring_source_period_unique
on public.expenses(source_type, source_id, generated_period);

-- Modelo de despesa recorrente (aluguel, assinaturas, internet, etc.).
create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  description text not null,
  category text,
  amount numeric(12,2) not null check(amount > 0),
  day_of_month integer not null default 1 check(day_of_month between 1 and 28),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recurring_expenses_organization_idx on public.recurring_expenses(organization_id);

alter table public.recurring_expenses enable row level security;
drop policy if exists recurring_expenses_access on public.recurring_expenses;
create policy recurring_expenses_access on public.recurring_expenses
for all using(organization_id in (select public.get_my_organization_ids()))
with check(organization_id in (select public.get_my_organization_ids()));

drop trigger if exists recurring_expenses_updated_at on public.recurring_expenses;
create trigger recurring_expenses_updated_at before update on public.recurring_expenses
for each row execute function public.update_updated_at();
