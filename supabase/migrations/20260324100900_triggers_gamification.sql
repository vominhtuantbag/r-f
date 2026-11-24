-- XP / levels / badges — deterministic triggers (no AI)

create or replace function public.recompute_driver_level(p_driver_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_xp int;
  v_level int;
begin
  select xp into v_xp from public.driver_gamification where driver_id = p_driver_id;
  select level into v_level
  from public.gamification_levels
  where xp_required <= v_xp
  order by xp_required desc
  limit 1;

  update public.driver_gamification
  set level = coalesce(v_level, 1), updated_at = timezone('utc', now())
  where driver_id = p_driver_id;
end;
$$;

create or replace function public.unlock_eligible_badges(p_driver_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_g public.driver_gamification%rowtype;
  v_driver public.drivers%rowtype;
  v_badge public.gamification_badges%rowtype;
  v_ok boolean;
begin
  select * into v_g from public.driver_gamification where driver_id = p_driver_id;
  select * into v_driver from public.drivers where id = p_driver_id;

  for v_badge in select * from public.gamification_badges where is_active
  loop
    v_ok := false;
    if v_badge.criteria_key = 'trips_completed' then
      v_ok := v_g.trips_completed >= v_badge.criteria_threshold;
    elsif v_badge.criteria_key = 'deliveries_completed' then
      v_ok := v_g.deliveries_completed >= v_badge.criteria_threshold;
    elsif v_badge.criteria_key = 'rating_avg' then
      v_ok := v_driver.rating_avg >= v_badge.criteria_threshold and v_driver.rating_count >= 20;
    end if;

    if v_ok then
      insert into public.driver_badges (driver_id, badge_id)
      values (p_driver_id, v_badge.id)
      on conflict do nothing;

      if found then
        update public.driver_gamification
          set xp = xp + v_badge.xp_reward
          where driver_id = p_driver_id;
      end if;
    end if;
  end loop;

  perform public.recompute_driver_level(p_driver_id);
end;
$$;

create or replace function public.on_ride_completed_gamification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed'
     and (old.status is distinct from 'completed')
     and new.driver_id is not null then
    insert into public.driver_gamification (driver_id)
    values (new.driver_id)
    on conflict (driver_id) do nothing;

    update public.driver_gamification
    set
      xp = xp + 25,
      trips_completed = trips_completed + 1,
      updated_at = timezone('utc', now())
    where driver_id = new.driver_id;

    perform public.unlock_eligible_badges(new.driver_id);
  end if;
  return new;
end;
$$;

create or replace function public.on_food_order_delivered_gamification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'delivered'
     and (old.status is distinct from 'delivered')
     and new.driver_id is not null then
    insert into public.driver_gamification (driver_id)
    values (new.driver_id)
    on conflict (driver_id) do nothing;

    update public.driver_gamification
    set
      xp = xp + 20,
      deliveries_completed = deliveries_completed + 1,
      updated_at = timezone('utc', now())
    where driver_id = new.driver_id;

    perform public.unlock_eligible_badges(new.driver_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ride_completed_xp on public.rides;
create trigger trg_ride_completed_xp
  after update of status on public.rides
  for each row execute function public.on_ride_completed_gamification();

drop trigger if exists trg_order_delivered_xp on public.food_orders;
create trigger trg_order_delivered_xp
  after update of status on public.food_orders
  for each row execute function public.on_food_order_delivered_gamification();
