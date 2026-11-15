-- Executar no SQL Editor do Supabase antes de ativar a sincronização.
-- task_id usa text para corresponder aos IDs "task-..." da aplicação.
create table if not exists public.task_sessions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id text not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  constraint task_sessions_valid_interval check (ended_at is null or ended_at >= started_at)
);

create index if not exists task_sessions_user_idx
  on public.task_sessions (user_id);
create index if not exists task_sessions_task_idx
  on public.task_sessions (user_id, task_id);

alter table public.task_sessions enable row level security;

create policy "Users can read own task sessions"
  on public.task_sessions for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own task sessions"
  on public.task_sessions for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own task sessions"
  on public.task_sessions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own task sessions"
  on public.task_sessions for delete to authenticated
  using ((select auth.uid()) = user_id);
