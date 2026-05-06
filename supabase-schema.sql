create table if not exists public.dashboard_state (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.dashboard_state enable row level security;

drop policy if exists "Authenticated users can read dashboard state" on public.dashboard_state;
create policy "Authenticated users can read dashboard state"
on public.dashboard_state
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can insert dashboard state" on public.dashboard_state;
create policy "Authenticated users can insert dashboard state"
on public.dashboard_state
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update dashboard state" on public.dashboard_state;
create policy "Authenticated users can update dashboard state"
on public.dashboard_state
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can delete dashboard state" on public.dashboard_state;
create policy "Authenticated users can delete dashboard state"
on public.dashboard_state
for delete
to authenticated
using (true);
