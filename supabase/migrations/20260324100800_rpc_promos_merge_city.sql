-- Promo validation, order merge eligibility, rule-based city apply

create or replace function public.validate_promo(
  p_code text,
  p_context text, -- 'ride' | 'food'
  p_market_id uuid,
  p_zone_id uuid default null,
  p_subtotal_minor bigint default 0
)
returns table (
  valid boolean,
  promo_id uuid,
  discount_minor bigint,
  message text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_promo public.promo_codes%rowtype;
  v_user_uses int;
  v_discount bigint;
begin
  select * into v_promo
  from public.promo_codes
  where upper(code) = upper(p_code)
    and is_active
    and starts_at <= timezone('utc', now())
    and expires_at >= timezone('utc', now());

  if not found then
    return query select false, null::uuid, 0::bigint, 'Promo không hợp lệ hoặc đã hết hạn';
    return;
  end if;

  if cardinality(v_promo.market_ids) > 0 and not (p_market_id = any (v_promo.market_ids)) then
    return query select false, null::uuid, 0::bigint, 'Promo không áp dụng cho khu vực này';
    return;
  end if;

  if p_zone_id is not null and cardinality(v_promo.zone_ids) > 0
     and not (p_zone_id = any (v_promo.zone_ids)) then
    return query select false, null::uuid, 0::bigint, 'Promo không áp dụng cho zone này';
    return;
  end if;

  if v_promo.applies_to = 'rides' and p_context <> 'ride' then
    return query select false, null::uuid, 0::bigint, 'Promo chỉ dùng cho chuyến xe';
    return;
  end if;
  if v_promo.applies_to = 'food' and p_context <> 'food' then
    return query select false, null::uuid, 0::bigint, 'Promo chỉ dùng cho đồ ăn';
    return;
  end if;

  if v_promo.max_total_uses is not null and v_promo.used_count >= v_promo.max_total_uses then
    return query select false, null::uuid, 0::bigint, 'Promo đã hết lượt';
    return;
  end if;

  if auth.uid() is not null then
    select count(*) into v_user_uses
    from public.promo_redemptions
    where promo_code_id = v_promo.id and user_id = auth.uid();
    if v_user_uses >= v_promo.max_uses_per_user then
      return query select false, null::uuid, 0::bigint, 'Bạn đã dùng hết lượt promo này';
      return;
    end if;
  end if;

  if v_promo.min_order_minor is not null and p_subtotal_minor < v_promo.min_order_minor then
    return query select false, null::uuid, 0::bigint, 'Chưa đủ giá trị tối thiểu';
    return;
  end if;

  if v_promo.discount_type = 'percentage' then
    v_discount := round(p_subtotal_minor * v_promo.discount_value / 100.0);
  else
    v_discount := round(v_promo.discount_value);
  end if;

  if v_promo.max_discount_minor is not null then
    v_discount := least(v_discount, v_promo.max_discount_minor);
  end if;
  v_discount := least(v_discount, p_subtotal_minor);

  return query select true, v_promo.id, v_discount, null::text;
end;
$$;

create or replace function public.find_mergeable_orders(p_order_id uuid)
returns setof public.food_orders
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_order public.food_orders%rowtype;
  v_rules public.order_merge_rules%rowtype;
begin
  select * into v_order from public.food_orders where id = p_order_id;
  if not found then return; end if;

  select * into v_rules from public.order_merge_rules where market_id = v_order.market_id;
  if not found or not v_rules.enabled then return; end if;

  return query
  select o.*
  from public.food_orders o
  where o.id <> v_order.id
    and o.restaurant_id = v_order.restaurant_id
    and o.market_id = v_order.market_id
    and o.status in ('ready', 'accepted', 'preparing')
    and o.merged_batch_id is null
    and o.created_at >= timezone('utc', now()) - make_interval(secs => v_rules.max_wait_seconds)
    and (
      v_rules.max_dropoff_distance_meters <= 0
      or st_dwithin(o.delivery_location, v_order.delivery_location, v_rules.max_dropoff_distance_meters)
    )
  order by o.created_at
  limit greatest(v_rules.max_orders - 1, 0);
end;
$$;

create or replace function public.create_or_attach_merge_batch(p_order_id uuid)
returns public.merged_order_batches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.food_orders%rowtype;
  v_rules public.order_merge_rules%rowtype;
  v_batch public.merged_order_batches%rowtype;
  v_candidate public.food_orders%rowtype;
  v_count int;
begin
  if not public.is_staff() and auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  select * into v_order from public.food_orders where id = p_order_id for update;
  select * into v_rules from public.order_merge_rules where market_id = v_order.market_id;
  if not found or not v_rules.enabled then
    raise exception 'Merge disabled for market';
  end if;

  if v_order.merged_batch_id is not null then
    select * into v_batch from public.merged_order_batches where id = v_order.merged_batch_id;
    return v_batch;
  end if;

  -- Prefer an open batch for same restaurant
  select b.* into v_batch
  from public.merged_order_batches b
  where b.restaurant_id = v_order.restaurant_id
    and b.status = 'open'
  order by b.created_at
  limit 1;

  if not found then
    insert into public.merged_order_batches (
      restaurant_id, market_id, zone_id, status, max_orders, max_distance_meters,
      pickup_location, currency_code
    )
    select
      v_order.restaurant_id, v_order.market_id, v_order.zone_id, 'open',
      v_rules.max_orders, v_rules.max_dropoff_distance_meters,
      r.location, v_order.currency_code
    from public.restaurants r where r.id = v_order.restaurant_id
    returning * into v_batch;
  end if;

  select count(*) into v_count from public.food_orders where merged_batch_id = v_batch.id;
  if v_count >= v_batch.max_orders then
    raise exception 'Batch full';
  end if;

  update public.food_orders set merged_batch_id = v_batch.id where id = v_order.id;

  for v_candidate in select * from public.find_mergeable_orders(p_order_id)
  loop
    select count(*) into v_count from public.food_orders where merged_batch_id = v_batch.id;
    exit when v_count >= v_batch.max_orders;
    update public.food_orders
      set merged_batch_id = v_batch.id
      where id = v_candidate.id and merged_batch_id is null;
  end loop;

  return v_batch;
end;
$$;

-- Manual / template city onboarding (replaces AI Setup Wizard)
create or replace function public.apply_city_pricing_template(
  p_template_code text,
  p_market_name text,
  p_slug text,
  p_country_code char(2),
  p_lng double precision,
  p_lat double precision,
  p_timezone text default 'Asia/Ho_Chi_Minh'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tpl public.city_pricing_templates%rowtype;
  v_market_id uuid;
  v_vehicle jsonb;
  v_zone jsonb;
  v_merge jsonb;
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;

  select * into v_tpl from public.city_pricing_templates where code = p_template_code and is_active;
  if not found then raise exception 'Template not found'; end if;

  insert into public.markets (
    name, slug, country_code, timezone, currency_code, currency_symbol, currency_decimal_places,
    pricing_mode, bidding_enabled, otp_trip_start_enabled, center
  ) values (
    p_market_name, p_slug, p_country_code, p_timezone,
    v_tpl.default_currency_code,
    case when v_tpl.default_currency_code = 'VND' then '₫' else v_tpl.default_currency_code end,
    case when v_tpl.default_currency_code = 'VND' then 0 else 2 end,
    v_tpl.default_pricing_mode,
    v_tpl.default_pricing_mode = 'bidding',
    v_tpl.otp_trip_start_enabled,
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
  ) returning id into v_market_id;

  for v_vehicle in select * from jsonb_array_elements(v_tpl.vehicle_presets)
  loop
    insert into public.vehicle_types (
      market_id, name, slug, capacity, base_fare_minor, per_km_minor, per_minute_minor,
      min_fare_minor, supports_parcel, supports_intercity, sort_order
    ) values (
      v_market_id,
      v_vehicle->>'name',
      v_vehicle->>'slug',
      coalesce((v_vehicle->>'capacity')::int, 1),
      coalesce((v_vehicle->>'base_fare_minor')::bigint, 0),
      coalesce((v_vehicle->>'per_km_minor')::bigint, 0),
      coalesce((v_vehicle->>'per_minute_minor')::bigint, 0),
      coalesce((v_vehicle->>'min_fare_minor')::bigint, 0),
      coalesce((v_vehicle->>'supports_parcel')::boolean, false),
      coalesce((v_vehicle->>'supports_intercity')::boolean, false),
      coalesce((v_vehicle->>'sort_order')::int, 0)
    );
  end loop;

  for v_zone in select * from jsonb_array_elements(v_tpl.zone_fee_presets)
  loop
    insert into public.delivery_zones (
      market_id, name, currency_code, currency_symbol, currency_decimal_places,
      delivery_fee_minor, min_order_minor, polygon
    ) values (
      v_market_id,
      v_zone->>'name',
      v_tpl.default_currency_code,
      case when v_tpl.default_currency_code = 'VND' then '₫' else v_tpl.default_currency_code end,
      case when v_tpl.default_currency_code = 'VND' then 0 else 2 end,
      coalesce((v_zone->>'delivery_fee_minor')::bigint, 0),
      coalesce((v_zone->>'min_order_minor')::bigint, 0),
      -- placeholder 1km square around center; admin can edit polygon later
      st_buffer(st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, 1000)
    );
  end loop;

  v_merge := v_tpl.merge_rule_presets;
  insert into public.order_merge_rules (
    market_id, enabled, max_orders, max_dropoff_distance_meters, max_wait_seconds, same_restaurant_only
  ) values (
    v_market_id,
    coalesce((v_merge->>'enabled')::boolean, true),
    coalesce((v_merge->>'max_orders')::int, 3),
    coalesce((v_merge->>'max_dropoff_distance_meters')::int, 2500),
    coalesce((v_merge->>'max_wait_seconds')::int, 420),
    coalesce((v_merge->>'same_restaurant_only')::boolean, true)
  );

  return v_market_id;
end;
$$;
