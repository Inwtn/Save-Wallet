-- Recurring monthly expenses are private to the authenticated owner.
create table if not exists public.finance_recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  description text not null check (char_length(btrim(description)) between 1 and 60),
  monthly_amount numeric(12, 2) not null check (monthly_amount > 0),
  start_month date not null,
  end_month date,
  created_at timestamptz not null default now(),
  check (end_month is null or end_month >= start_month)
);

create index if not exists finance_recurring_expenses_user_month_idx
  on public.finance_recurring_expenses (user_id, start_month, end_month);

alter table public.finance_recurring_expenses enable row level security;
revoke all on table public.finance_recurring_expenses from public, anon, authenticated;
grant select, insert, update, delete on table public.finance_recurring_expenses to authenticated;

drop policy if exists "Users can view their own planned expenses" on public.finance_recurring_expenses;
create policy "Users can view their own planned expenses"
  on public.finance_recurring_expenses for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can add their own planned expenses" on public.finance_recurring_expenses;
create policy "Users can add their own planned expenses"
  on public.finance_recurring_expenses for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own planned expenses" on public.finance_recurring_expenses;
create policy "Users can update their own planned expenses"
  on public.finance_recurring_expenses for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own planned expenses" on public.finance_recurring_expenses;
create policy "Users can delete their own planned expenses"
  on public.finance_recurring_expenses for delete to authenticated
  using ((select auth.uid()) = user_id);
