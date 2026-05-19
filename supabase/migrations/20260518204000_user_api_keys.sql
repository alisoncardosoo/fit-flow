-- Per-user API keys for AI provider access.
-- Stored separately from profiles to avoid accidental exposure in public profile queries.
create table if not exists public.user_api_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  api_key text not null check (char_length(trim(api_key)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_api_keys enable row level security;

create policy "Users can view own API key"
  on public.user_api_keys
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own API key"
  on public.user_api_keys
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own API key"
  on public.user_api_keys
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own API key"
  on public.user_api_keys
  for delete
  using (auth.uid() = user_id);

create or replace function public.set_updated_at_user_api_keys()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_api_keys_updated_at on public.user_api_keys;
create trigger trg_user_api_keys_updated_at
before update on public.user_api_keys
for each row execute function public.set_updated_at_user_api_keys();
