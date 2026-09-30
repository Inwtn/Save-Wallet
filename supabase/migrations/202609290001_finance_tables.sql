-- Execute once in Supabase SQL Editor. These tables are safe to expose through
-- the Data API only because grants are restricted and RLS is enabled below.
create table if not exists public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  description text not null check (char_length(btrim(description)) between 1 and 60),
  amount numeric(12, 2) not null check (amount > 0),
  category text not null check (char_length(btrim(category)) between 1 and 40),
  date date not null,
  created_at timestamptz not null default now()
);

create index if not exists finance_transactions_user_date_idx
  on public.finance_transactions (user_id, date desc);

alter table public.finance_transactions enable row level security;
revoke all on table public.finance_transactions from public, anon, authenticated;
grant select, insert, update, delete on table public.finance_transactions to authenticated;

drop policy if exists "Users can view their own transactions" on public.finance_transactions;
create policy "Users can view their own transactions"
  on public.finance_transactions for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can add their own transactions" on public.finance_transactions;
create policy "Users can add their own transactions"
  on public.finance_transactions for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own transactions" on public.finance_transactions;
create policy "Users can update their own transactions"
  on public.finance_transactions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own transactions" on public.finance_transactions;
create policy "Users can delete their own transactions"
  on public.finance_transactions for delete to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.finance_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  monthly_budget numeric(12, 2) not null default 0 check (monthly_budget >= 0),
  updated_at timestamptz not null default now()
);

alter table public.finance_settings enable row level security;
revoke all on table public.finance_settings from public, anon, authenticated;
grant select, insert, update on table public.finance_settings to authenticated;

drop policy if exists "Users can view their own settings" on public.finance_settings;
create policy "Users can view their own settings"
  on public.finance_settings for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own settings" on public.finance_settings;
create policy "Users can create their own settings"
  on public.finance_settings for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own settings" on public.finance_settings;
create policy "Users can update their own settings"
  on public.finance_settings for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
