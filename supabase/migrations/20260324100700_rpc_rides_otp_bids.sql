-- Ride fare estimate, create, trip transitions (OTP), bidding

create or replace function public.estimate_ride_fare(
  p_market_id uuid,
  p_vehicle_type_id uuid,
  p_distance_meters int,
  p_duration_seconds int
)
returns table (
  estimated_fare_minor bigint,
  min_bid_minor bigint,
  max_bid_minor bigint,
  pricing_mode public.pricing_mode,
  otp_required boolean,
  currency_code char(3),
  currency_symbol text,
  currency_decimal_places int
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_market public.markets%rowtype;
  v_vehicle public.vehicle_types%rowtype;
  v_fare bigint;
  v_distance_km numeric;
  v_duration_min numeric;
begin
  select * into v_market from public.markets where id = p_market_id and is_active;
  if not found then raise exception 'Market not found'; end if;

  select * into v_vehicle from public.vehicle_types
    where id = p_vehicle_type_id and market_id = p_market_id and is_active;
  if not found then raise exception 'Vehicle type not found'; end if;

  v_distance_km := greatest(p_distance_meters, 0) / 1000.0;
  v_duration_min := greatest(p_duration_seconds, 0) / 60.0;
  v_fare := v_vehicle.base_fare_minor
    + round(v_vehicle.per_km_minor * v_distance_km)
    + round(v_vehicle.per_minute_minor * v_duration_min);

  if v_market.surge_enabled and v_market.surge_multiplier > 1 then
    v_fare := round(v_fare * v_market.surge_multiplier);
  end if;

  v_fare := greatest(v_fare, v_vehicle.min_fare_minor);

  return query select
    v_fare,
    case when v_market.pricing_mode = 'bidding' then greatest(1, round(v_fare * 0.7)) else null end,
    case when v_market.pricing_mode = 'bidding' then round(v_fare * 1.4) else null end,
    v_market.pricing_mode,
    v_market.otp_trip_start_enabled,
    v_market.currency_code,
    v_market.currency_symbol,
    v_market.currency_decimal_places;
end;
$$;

create or replace function public.create_ride(
  p_market_id uuid,
  p_vehicle_type_id uuid,
  p_stops jsonb,
  p_payment_method public.payment_method,
  p_is_parcel boolean default false,
  p_is_intercity boolean default false,
  p_scheduled_at timestamptz default null,
  p_offered_fare_minor bigint default null,
  p_notes text default null
)
returns public.rides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_est record;
  v_ride public.rides;
  v_stop jsonb;
  v_seq int := 0;
  v_distance int := 3000;
  v_duration int := 600;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;

  select * into v_est from public.estimate_ride_fare(p_market_id, p_vehicle_type_id, v_distance, v_duration);

  insert into public.rides (
    code, rider_id, market_id, vehicle_type_id, status, pricing_mode,
    is_parcel, is_intercity, scheduled_at, distance_meters, duration_seconds,
    estimated_fare_minor, offered_fare_minor, currency_code, currency_symbol,
    currency_decimal_places, payment_method, otp_required, notes
  ) values (
    public.generate_entity_code('R'),
    auth.uid(),
    p_market_id,
    p_vehicle_type_id,
    case when v_est.pricing_mode = 'bidding' then 'bidding'::public.ride_status else 'searching'::public.ride_status end,
    v_est.pricing_mode,
    p_is_parcel,
    p_is_intercity,
    p_scheduled_at,
    v_distance,
    v_duration,
    v_est.estimated_fare_minor,
    p_offered_fare_minor,
    v_est.currency_code,
    v_est.currency_symbol,
    v_est.currency_decimal_places,
    p_payment_method,
    v_est.otp_required,
    p_notes
  ) returning * into v_ride;

  for v_stop in select * from jsonb_array_elements(p_stops)
  loop
    insert into public.ride_stops (ride_id, stop_type, sequence, address, location, contact_name, contact_phone)
    values (
      v_ride.id,
      v_stop->>'type',
      v_seq,
      v_stop->>'address',
      st_setsrid(st_makepoint((v_stop->'point'->>'lng')::float, (v_stop->'point'->>'lat')::float), 4326)::geography,
      v_stop->>'contactName',
      v_stop->>'contactPhone'
    );
    v_seq := v_seq + 1;
  end loop;

  return v_ride;
end;
$$;

create or replace function public.transition_ride(
  p_ride_id uuid,
  p_action text,
  p_otp text default null,
  p_lat double precision default null,
  p_lng double precision default null
)
returns public.rides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.rides;
  v_driver_id uuid := auth.uid();
begin
  select * into v_ride from public.rides where id = p_ride_id for update;
  if not found then raise exception 'Ride not found'; end if;

  if p_action = 'accept' then
    if v_ride.status not in ('searching', 'bidding') then raise exception 'Invalid status'; end if;
    update public.rides set
      status = 'accepted',
      driver_id = v_driver_id,
      accepted_at = timezone('utc', now()),
      otp_code = case when otp_required then public.generate_otp_code() else null end
    where id = p_ride_id
    returning * into v_ride;

  elsif p_action = 'arrive' then
    if v_ride.driver_id <> v_driver_id then raise exception 'Not your ride'; end if;
    if v_ride.status <> 'accepted' then raise exception 'Invalid status'; end if;
    update public.rides set status = 'driver_arrived', arrived_at = timezone('utc', now())
    where id = p_ride_id returning * into v_ride;

  elsif p_action = 'start' then
    if v_ride.driver_id <> v_driver_id then raise exception 'Not your ride'; end if;
    if v_ride.status <> 'driver_arrived' then raise exception 'Invalid status'; end if;
    if v_ride.otp_required then
      if p_otp is null or p_otp <> v_ride.otp_code then
        raise exception 'Invalid OTP';
      end if;
    end if;
    update public.rides set status = 'in_progress', started_at = timezone('utc', now())
    where id = p_ride_id returning * into v_ride;

  elsif p_action = 'complete' then
    if v_ride.driver_id <> v_driver_id then raise exception 'Not your ride'; end if;
    if v_ride.status <> 'in_progress' then raise exception 'Invalid status'; end if;
    update public.rides set
      status = 'completed',
      completed_at = timezone('utc', now()),
      final_fare_minor = coalesce(final_fare_minor, offered_fare_minor, estimated_fare_minor)
    where id = p_ride_id returning * into v_ride;

  elsif p_action = 'cancel' then
    if v_ride.rider_id <> auth.uid() and v_ride.driver_id <> auth.uid() and not public.is_staff() then
      raise exception 'Forbidden';
    end if;
    update public.rides set status = 'cancelled', cancelled_at = timezone('utc', now())
    where id = p_ride_id returning * into v_ride;
  else
    raise exception 'Unknown action';
  end if;

  if p_lat is not null and p_lng is not null and v_driver_id is not null then
    update public.drivers set
      last_location = st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
      last_location_at = timezone('utc', now())
    where id = v_driver_id;
  end if;

  return v_ride;
end;
$$;

create or replace function public.place_fare_bid(
  p_ride_id uuid,
  p_amount_minor bigint,
  p_message text default null
)
returns public.fare_bids
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.rides;
  v_bid public.fare_bids;
  v_bounds record;
begin
  select * into v_ride from public.rides where id = p_ride_id;
  if not found then raise exception 'Ride not found'; end if;
  if v_ride.pricing_mode <> 'bidding' or v_ride.status <> 'bidding' then
    raise exception 'Bidding not open';
  end if;

  select * into v_bounds from public.estimate_ride_fare(
    v_ride.market_id, v_ride.vehicle_type_id,
    coalesce(v_ride.distance_meters, 3000), coalesce(v_ride.duration_seconds, 600)
  );

  if p_amount_minor < v_bounds.min_bid_minor or p_amount_minor > v_bounds.max_bid_minor then
    raise exception 'Bid out of bounds';
  end if;

  insert into public.fare_bids (ride_id, driver_id, amount_minor, currency_code, message, expires_at)
  values (
    p_ride_id, auth.uid(), p_amount_minor, v_ride.currency_code, p_message,
    timezone('utc', now()) + interval '3 minutes'
  )
  on conflict (ride_id, driver_id) do update set
    amount_minor = excluded.amount_minor,
    message = excluded.message,
    status = 'pending',
    expires_at = excluded.expires_at,
    updated_at = timezone('utc', now())
  returning * into v_bid;

  return v_bid;
end;
$$;

create or replace function public.accept_fare_bid(p_ride_id uuid, p_bid_id uuid)
returns public.rides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.rides;
  v_bid public.fare_bids;
begin
  select * into v_ride from public.rides where id = p_ride_id for update;
  if v_ride.rider_id <> auth.uid() then raise exception 'Forbidden'; end if;

  select * into v_bid from public.fare_bids where id = p_bid_id and ride_id = p_ride_id;
  if not found or v_bid.status <> 'pending' then raise exception 'Bid unavailable'; end if;

  update public.fare_bids set status = 'rejected'
    where ride_id = p_ride_id and id <> p_bid_id and status = 'pending';
  update public.fare_bids set status = 'accepted' where id = p_bid_id;

  update public.rides set
    status = 'accepted',
    driver_id = v_bid.driver_id,
    offered_fare_minor = v_bid.amount_minor,
    final_fare_minor = v_bid.amount_minor,
    accepted_at = timezone('utc', now()),
    otp_code = case when otp_required then public.generate_otp_code() else null end
  where id = p_ride_id
  returning * into v_ride;

  return v_ride;
end;
$$;
