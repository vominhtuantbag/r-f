-- Shared helpers + auth role checks

create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('admin', 'support_agent') from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.generate_otp_code()
returns char(4)
language sql
volatile
as $$
  select lpad((floor(random() * 10000))::int::text, 4, '0');
$$;

create or replace function public.generate_entity_code(prefix text)
returns text
language sql
volatile
as $$
  select prefix || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 8));
$$;

-- Auto-create profile on signup
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
    v_role := (new.raw_user_meta_data->>'role')::public.user_role;
  end if;

  insert into public.profiles (id, role, email, phone, first_name, last_name, locale)
  values (
    new.id,
    v_role,
    new.email,
    new.phone,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce(new.raw_user_meta_data->>'locale', 'vi')
  );

  if v_role = 'driver' then
    insert into public.drivers (id) values (new.id);
    insert into public.driver_gamification (driver_id) values (new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
