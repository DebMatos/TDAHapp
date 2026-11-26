-- Migração aditiva para categorias local-first. Não altera tarefas existentes.
create table if not exists public.categories (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 50),
  icon text not null,
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  is_system boolean not null default false,
  archived boolean not null default false,
  favorite_order integer,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  constraint categories_favorite_order_valid check (favorite_order is null or favorite_order between 0 and 4),
  constraint categories_inbox_not_archived check (id <> 'inbox' or archived = false),
  primary key (user_id, id)
);

alter table public.categories add column if not exists is_system boolean not null default false;
update public.categories set is_system = true where id in ('inbox', 'work', 'personal', 'exercise');

create index if not exists categories_user_idx on public.categories (user_id);
create index if not exists categories_user_favorite_order_idx
  on public.categories (user_id, favorite_order) where favorite_order is not null and archived = false;

alter table public.categories enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'categories'
      and policyname = 'Users can read own categories'
  ) then
    create policy "Users can read own categories" on public.categories for select to authenticated
      using ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'categories'
      and policyname = 'Users can insert own categories'
  ) then
    create policy "Users can insert own categories" on public.categories for insert to authenticated
      with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'categories'
      and policyname = 'Users can update own categories'
  ) then
    create policy "Users can update own categories" on public.categories for update to authenticated
      using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
end
$$;

-- Não existe política DELETE: o produto suporta apenas arquivo e restauro.
