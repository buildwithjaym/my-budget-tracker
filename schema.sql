create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can view own profile"
on public.profiles
for select
using (auth.uid() = id);

create policy "Users can insert own profile"
on public.profiles
for insert
with check (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();


create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  amount numeric(12,2) not null check (amount > 0),
  category text not null,
  note text,
  transaction_date date not null default current_date,
  created_at timestamp with time zone default now()
);

alter table public.transactions enable row level security;

create policy "Users can manage own transactions"
on public.transactions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);


create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text,
  amount numeric(12,2) not null check (amount > 0),
  month integer not null check (month between 1 and 12),
  year integer not null,
  created_at timestamp with time zone default now(),
  unique(user_id, category, month, year)
);

alter table public.budgets enable row level security;

create policy "Users can manage own budgets"
on public.budgets
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);



create index if not exists transactions_user_date_idx
on public.transactions (user_id, transaction_date desc);

create index if not exists transactions_user_type_date_idx
on public.transactions (user_id, type, transaction_date desc);

create index if not exists transactions_user_category_date_idx
on public.transactions (user_id, category, transaction_date desc);

create index if not exists budgets_user_month_year_idx
on public.budgets (user_id, month, year);

create index if not exists budgets_user_category_month_year_idx
on public.budgets (user_id, category, month, year);










create or replace function public.get_dashboard_summary(
  target_month integer,
  target_year integer
)
returns table (
  total_income numeric,
  total_expenses numeric,
  balance numeric,
  monthly_budget numeric,
  budget_used numeric,
  alert_type text
)
language sql
security invoker
set search_path = public
as $$
  with monthly_transactions as (
    select *
    from public.transactions
    where user_id = auth.uid()
      and extract(month from transaction_date)::integer = target_month
      and extract(year from transaction_date)::integer = target_year
  ),
  totals as (
    select
      coalesce(sum(amount) filter (where type = 'income'), 0) as income,
      coalesce(sum(amount) filter (where type = 'expense'), 0) as expenses
    from monthly_transactions
  ),
  budget_total as (
    select coalesce(sum(amount), 0) as budget
    from public.budgets
    where user_id = auth.uid()
      and month = target_month
      and year = target_year
  )
  select
    totals.income as total_income,
    totals.expenses as total_expenses,
    totals.income - totals.expenses as balance,
    budget_total.budget as monthly_budget,
    case
      when budget_total.budget > 0
      then round((totals.expenses / budget_total.budget) * 100, 2)
      else 0
    end as budget_used,
    case
      when budget_total.budget = 0 then 'none'
      when totals.expenses >= budget_total.budget then 'exceeded'
      when totals.expenses >= budget_total.budget * 0.8 then 'warning'
      else 'safe'
    end as alert_type
  from totals, budget_total;
$$;


create or replace function public.get_recent_transactions(limit_count integer default 5)
returns table (
  id uuid,
  type text,
  amount numeric,
  category text,
  note text,
  transaction_date date,
  created_at timestamp with time zone
)
language sql
security invoker
set search_path = public
as $$
  select
    id,
    type,
    amount,
    category,
    note,
    transaction_date,
    created_at
  from public.transactions
  where user_id = auth.uid()
  order by transaction_date desc, created_at desc
  limit limit_count;
$$;

alter table public.budgets
alter column category set not null;


create policy "Users can upload their own avatar"
on storage.objects
for insert
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can update their own avatar"
on storage.objects
for update
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can delete their own avatar"
on storage.objects
for delete
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Avatar images are publicly readable"
on storage.objects
for select
using (bucket_id = 'avatars');

alter table public.profiles
add column if not exists updated_at timestamp with time zone default now();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();


drop policy if exists "Avatar images are publicly readable" on storage.objects;
drop policy if exists "Users can upload their own avatar" on storage.objects;
drop policy if exists "Users can update their own avatar" on storage.objects;
drop policy if exists "Users can delete their own avatar" on storage.objects;

create policy "Avatar images are publicly readable"
on storage.objects
for select
using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
on storage.objects
for insert
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can update their own avatar"
on storage.objects
for update
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can delete their own avatar"
on storage.objects
for delete
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);