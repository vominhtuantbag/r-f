-- Cron jobs (enable pg_cron on hosted Supabase) + city pricing template seeds

-- Expire stale bids
create or replace function public.job_expire_fare_bids()
returns void
language sql
security definer
set search_path = public
as $$
  update public.fare_bids
  set status = 'expired', updated_at = timezone('utc', now())
  where status = 'pending' and expires_at < timezone('utc', now());
$$;

-- Auto-cancel abandoned searching rides (>30m)
create or replace function public.job_cancel_stale_rides()
returns void
language sql
security definer
set search_path = public
as $$
  update public.rides
  set status = 'cancelled', cancelled_at = timezone('utc', now())
  where status in ('searching', 'bidding', 'draft')
    and created_at < timezone('utc', now()) - interval '30 minutes'
    and scheduled_at is null;
$$;

-- Reset subscription free-delivery counters on period rollover (hourly check)
create or replace function public.job_roll_subscription_periods()
returns void
language sql
security definer
set search_path = public
as $$
  update public.user_subscriptions
  set
    status = case when cancel_at_period_end then 'cancelled'::public.subscription_status else status end,
    current_period_start = case when not cancel_at_period_end then current_period_end else current_period_start end,
    current_period_end = case
      when not cancel_at_period_end then current_period_end + interval '1 month'
      else current_period_end
    end,
    free_delivery_used_this_period = case when not cancel_at_period_end then 0 else free_delivery_used_this_period end,
    updated_at = timezone('utc', now())
  where status = 'active'
    and current_period_end <= timezone('utc', now());
$$;

-- Schedule (no-op if pg_cron unavailable)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname in (
      'expire_fare_bids', 'cancel_stale_rides', 'roll_subscription_periods'
    );
    perform cron.schedule('expire_fare_bids', '*/2 * * * *', 'select public.job_expire_fare_bids()');
    perform cron.schedule('cancel_stale_rides', '*/5 * * * *', 'select public.job_cancel_stale_rides()');
    perform cron.schedule('roll_subscription_periods', '15 * * * *', 'select public.job_roll_subscription_periods()');
  end if;
exception when others then
  raise notice 'pg_cron not available — schedule jobs in Supabase dashboard';
end $$;

-- Public tracking (anon-safe via token)
create or replace function public.track_ride_by_token(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(r) - 'otp_code'
  from public.rides r
  where r.tracking_token = p_token;
$$;

create or replace function public.track_order_by_token(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(o)
  from public.food_orders o
  where o.tracking_token = p_token;
$$;

grant execute on function public.track_ride_by_token(text) to anon, authenticated;
grant execute on function public.track_order_by_token(text) to anon, authenticated;
grant execute on function public.estimate_ride_fare(uuid, uuid, int, int) to authenticated;
grant execute on function public.create_ride(uuid, uuid, jsonb, public.payment_method, boolean, boolean, timestamptz, bigint, text) to authenticated;
grant execute on function public.transition_ride(uuid, text, text, double precision, double precision) to authenticated;
grant execute on function public.place_fare_bid(uuid, bigint, text) to authenticated;
grant execute on function public.accept_fare_bid(uuid, uuid) to authenticated;
grant execute on function public.validate_promo(text, text, uuid, uuid, bigint) to authenticated, anon;
grant execute on function public.find_mergeable_orders(uuid) to authenticated;
grant execute on function public.create_or_attach_merge_batch(uuid) to authenticated;
grant execute on function public.apply_city_pricing_template(text, text, text, char, double precision, double precision, text) to authenticated;

-- City pricing templates (deterministic presets)
insert into public.city_pricing_templates (
  code, name, description, default_currency_code, default_pricing_mode,
  otp_trip_start_enabled, vehicle_presets, zone_fee_presets, merge_rule_presets, surge_rules
) values
(
  'vn_tier_b',
  'Việt Nam — thành phố vừa',
  'Preset cho thị trường cấp huyện/thị xã (VND, fixed + optional bidding)',
  'VND',
  'fixed',
  true,
  '[
    {"name":"Xe máy","slug":"bike","capacity":1,"base_fare_minor":10000,"per_km_minor":4000,"per_minute_minor":500,"min_fare_minor":15000,"supports_parcel":true,"sort_order":1},
    {"name":"Ô tô 4 chỗ","slug":"car4","capacity":4,"base_fare_minor":20000,"per_km_minor":8000,"per_minute_minor":1000,"min_fare_minor":30000,"supports_parcel":false,"sort_order":2},
    {"name":"Xe tải nhỏ","slug":"truck","capacity":2,"base_fare_minor":40000,"per_km_minor":12000,"per_minute_minor":1500,"min_fare_minor":50000,"supports_parcel":true,"supports_intercity":true,"sort_order":3}
  ]'::jsonb,
  '[
    {"name":"Nội thành","delivery_fee_minor":15000,"min_order_minor":30000},
    {"name":"Ngoại thành","delivery_fee_minor":25000,"min_order_minor":50000}
  ]'::jsonb,
  '{"enabled":true,"max_orders":3,"max_dropoff_distance_meters":2500,"max_wait_seconds":420,"same_restaurant_only":true}'::jsonb,
  '{"enabled":false,"multiplier":1.2,"hours":[17,18,19]}'::jsonb
),
(
  'vn_bidding',
  'Việt Nam — InDrive bidding',
  'Preset bật bidding + OTP',
  'VND',
  'bidding',
  true,
  '[
    {"name":"Xe máy","slug":"bike","capacity":1,"base_fare_minor":10000,"per_km_minor":4000,"per_minute_minor":500,"min_fare_minor":15000,"supports_parcel":true,"sort_order":1},
    {"name":"Ô tô 4 chỗ","slug":"car4","capacity":4,"base_fare_minor":20000,"per_km_minor":8000,"per_minute_minor":1000,"min_fare_minor":30000,"sort_order":2}
  ]'::jsonb,
  '[{"name":"Nội thành","delivery_fee_minor":15000,"min_order_minor":30000}]'::jsonb,
  '{"enabled":true,"max_orders":3,"max_dropoff_distance_meters":2000,"max_wait_seconds":360,"same_restaurant_only":true}'::jsonb,
  '{"enabled":true,"multiplier":1.3,"hours":[7,8,17,18,19]}'::jsonb
)
on conflict (code) do nothing;
