-- Allow authenticated users to insert their own profile row (fallback if trigger lags).
-- Primary path remains handle_new_user() SECURITY DEFINER trigger.

alter table public.profiles enable row level security;

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert
  with check (id = auth.uid());
