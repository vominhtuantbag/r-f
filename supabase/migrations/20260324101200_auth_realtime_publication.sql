-- =============================================================================
-- Auth profile sync + Realtime publication notes (Ride & Food)
-- Idempotent / documentation-oriented follow-up to:
--   - 20260324100600_rpc_helpers.sql  (handle_new_user + on_auth_user_created)
--   - 20260324101000_rls_policies.sql (profiles / rides / bids / orders / chat)
-- =============================================================================

-- 1) Ensure profile auto-create on auth.users insert (already defined; recreate safely)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role := 'rider';
begin
  if new.raw_user_meta_data ? 'role' then
    begin
      v_role := (new.raw_user_meta_data->>'role')::public.user_role;
    exception when others then
      v_role := 'rider';
    end;
  end if;

  insert into public.profiles (id, role, email, phone, first_name, last_name, locale, market_id)
  values (
    new.id,
    v_role,
    new.email,
    new.phone,
    coalesce(new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'given_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', new.raw_user_meta_data->>'family_name', ''),
    coalesce(new.raw_user_meta_data->>'locale', 'vi'),
    nullif(new.raw_user_meta_data->>'market_id', '')::uuid
  )
  on conflict (id) do update set
    email = excluded.email,
    phone = coalesce(excluded.phone, public.profiles.phone),
    first_name = case when excluded.first_name <> '' then excluded.first_name else public.profiles.first_name end,
    last_name = case when excluded.last_name <> '' then excluded.last_name else public.profiles.last_name end;

  if v_role = 'driver' then
    insert into public.drivers (id) values (new.id) on conflict (id) do nothing;
    insert into public.driver_gamification (driver_id) values (new.id) on conflict (driver_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) RLS reminder (policies live in 20260324101000_rls_policies.sql):
--    profiles: select/update own or staff/admin
--    rides:    rider/driver/staff
--    fare_bids: driver insert; rider/driver select on own ride
--    food_orders / merged_order_batches: rider/driver/partner/staff
--    support_*: ticket participants + staff
--    NEVER expose service_role to Expo clients — anon key + RLS only.

-- 3) Optional GPS metadata columns used by subscribeDriverLocation
alter table public.drivers add column if not exists heading double precision;
alter table public.drivers add column if not exists speed_mps double precision;

-- 4) Realtime publication for app channel helpers
--    (subscribeRideStatus, subscribeRideBids, subscribeFoodOrder,
--     subscribeMergedBatch, subscribeSupportChat, subscribeDriverLocation)
do $$
begin
  begin
    alter publication supabase_realtime add table public.rides;
  exception when duplicate_object then null; when undefined_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.fare_bids;
  exception when duplicate_object then null; when undefined_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.food_orders;
  exception when duplicate_object then null; when undefined_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.merged_order_batches;
  exception when duplicate_object then null; when undefined_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.support_messages;
  exception when duplicate_object then null; when undefined_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.drivers;
  exception when duplicate_object then null; when undefined_object then null;
  end;
end $$;
