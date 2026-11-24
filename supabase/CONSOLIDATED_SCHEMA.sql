-- =============================================================================
-- Ride & Food — CONSOLIDATED SCHEMA (single-run, idempotent)
-- Paste into Supabase SQL Editor and execute once (safe to re-run).
-- Stack: Expo + Supabase + Vercel | 100% TypeScript clients | NO AI objects
-- Covers: markets/zones/multi-currency, dual pricing, profiles+auth trigger,
--         rides/OTP/bids/GPS, food+merged batches, promos, subscriptions,
--         wallet, gamification, support, RLS, realtime publication, RPCs
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0) Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";
create extension if not exists "postgis";
create extension if not exists "pg_trgm";
-- Optional on hosted Supabase (Dashboard → Database → Extensions):
-- create extension if not exists "pg_cron";


-- ===== BEGIN 20260324100000_extensions_enums.sql =====


do $$ begin
  create type public.user_role as enum ('rider', 'driver', 'partner', 'admin', 'support_agent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.pricing_mode as enum ('fixed', 'bidding');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum (
    'cash', 'card', 'wallet', 'stripe', 'paypal', 'razorpay', 'myfatoorah'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ride_status as enum (
    'draft', 'searching', 'bidding', 'accepted', 'driver_arrived',
    'in_progress', 'completed', 'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.food_order_status as enum (
    'pending', 'accepted', 'preparing', 'ready', 'picked_up',
    'delivered', 'cancelled', 'refunded'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.bid_status as enum ('pending', 'accepted', 'rejected', 'countered', 'expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.promo_discount_type as enum ('percentage', 'fixed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.promo_applies_to as enum ('rides', 'food', 'both');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.subscription_interval as enum ('monthly', 'yearly');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.subscription_status as enum ('active', 'cancelled', 'expired', 'past_due');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.document_status as enum ('pending', 'approved', 'rejected', 'expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.support_ticket_status as enum ('open', 'pending', 'escalated', 'resolved', 'closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.refund_status as enum ('none', 'requested', 'approved', 'rejected', 'processed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.withdrawal_status as enum ('pending', 'approved', 'rejected', 'paid');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.merged_batch_status as enum ('open', 'assigned', 'picked_up', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.wallet_tx_type as enum ('credit', 'debit');
exception when duplicate_object then null; end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;
-- ===== END 20260324100000_extensions_enums.sql =====

-- ===== BEGIN 20260324100100_profiles_markets_zones.sql =====
-- Profiles, markets, zones, vehicles, city pricing templates

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'rider',
  email text,
  phone text unique,
  phone_verified boolean not null default false,
  first_name text not null default '',
  last_name text not null default '',
  avatar_url text,
  locale text not null default 'vi',
  market_id uuid,
  wallet_balance_minor bigint not null default 0 check (wallet_balance_minor >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.markets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  country_code char(2) not null,
  timezone text not null default 'Asia/Ho_Chi_Minh',
  currency_code char(3) not null default 'VND',
  currency_symbol text not null default '₫',
  currency_decimal_places int not null default 0 check (currency_decimal_places between 0 and 4),
  pricing_mode public.pricing_mode not null default 'fixed',
  bidding_enabled boolean not null default false,
  otp_trip_start_enabled boolean not null default false,
  surge_enabled boolean not null default false,
  surge_multiplier numeric(4,2) not null default 1.00 check (surge_multiplier >= 1),
  is_active boolean not null default true,
  center geography(point, 4326) not null,
  bounds geography(polygon, 4326),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles
  drop constraint if exists profiles_market_id_fkey;
alter table public.profiles
  add constraint profiles_market_id_fkey
  foreign key (market_id) references public.markets (id) on delete set null;

create table if not exists public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets (id) on delete cascade,
  name text not null,
  currency_code char(3) not null,
  currency_symbol text not null,
  currency_decimal_places int not null default 0,
  delivery_fee_minor bigint not null default 0 check (delivery_fee_minor >= 0),
  free_delivery_min_order_minor bigint,
  min_order_minor bigint not null default 0,
  polygon geography(polygon, 4326) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (market_id, name)
);

create table if not exists public.vehicle_types (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets (id) on delete cascade,
  name text not null,
  slug text not null,
  capacity int not null default 1 check (capacity > 0),
  icon_url text,
  base_fare_minor bigint not null default 0,
  per_km_minor bigint not null default 0,
  per_minute_minor bigint not null default 0,
  min_fare_minor bigint not null default 0,
  supports_parcel boolean not null default false,
  supports_intercity boolean not null default false,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (market_id, slug)
);

-- Rule-based city onboarding templates (replaces AI Setup Wizard)
create table if not exists public.city_pricing_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  default_currency_code char(3) not null,
  default_pricing_mode public.pricing_mode not null default 'fixed',
  otp_trip_start_enabled boolean not null default false,
  vehicle_presets jsonb not null default '[]'::jsonb,
  zone_fee_presets jsonb not null default '[]'::jsonb,
  merge_rule_presets jsonb not null default '{}'::jsonb,
  surge_rules jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.drivers (
  id uuid primary key references public.profiles (id) on delete cascade,
  market_id uuid references public.markets (id) on delete set null,
  is_online boolean not null default false,
  last_location geography(point, 4326),
  last_location_at timestamptz,
  vehicle_type_id uuid references public.vehicle_types (id) on delete set null,
  vehicle_label text,
  rating_avg numeric(3,2) not null default 5.00,
  rating_count int not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.driver_documents (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers (id) on delete cascade,
  doc_type text not null check (doc_type in (
    'license', 'id_card', 'vehicle_registration', 'insurance', 'profile_photo'
  )),
  file_path text not null,
  status public.document_status not null default 'pending',
  rejection_reason text,
  expires_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_markets_center on public.markets using gist (center);
create index if not exists idx_zones_polygon on public.delivery_zones using gist (polygon);
create index if not exists idx_drivers_location on public.drivers using gist (last_location);
create index if not exists idx_profiles_role on public.profiles (role);

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
drop trigger if exists trg_markets_updated on public.markets;
create trigger trg_markets_updated before update on public.markets
  for each row execute function public.set_updated_at();
drop trigger if exists trg_zones_updated on public.delivery_zones;
create trigger trg_zones_updated before update on public.delivery_zones
  for each row execute function public.set_updated_at();
drop trigger if exists trg_vehicle_types_updated on public.vehicle_types;
create trigger trg_vehicle_types_updated before update on public.vehicle_types
  for each row execute function public.set_updated_at();
drop trigger if exists trg_drivers_updated on public.drivers;
create trigger trg_drivers_updated before update on public.drivers
  for each row execute function public.set_updated_at();
-- ===== END 20260324100100_profiles_markets_zones.sql =====

-- ===== BEGIN 20260324100200_rides_bids.sql =====
-- Rides, stops, fare bids, intercity routes

create table if not exists public.intercity_routes (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets (id) on delete cascade,
  name text not null,
  origin_label text not null,
  destination_label text not null,
  origin geography(point, 4326) not null,
  destination geography(point, 4326) not null,
  base_fare_minor bigint not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.rides (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  rider_id uuid not null references public.profiles (id),
  driver_id uuid references public.drivers (id),
  market_id uuid not null references public.markets (id),
  vehicle_type_id uuid not null references public.vehicle_types (id),
  status public.ride_status not null default 'draft',
  pricing_mode public.pricing_mode not null,
  is_parcel boolean not null default false,
  is_intercity boolean not null default false,
  intercity_route_id uuid references public.intercity_routes (id),
  scheduled_at timestamptz,
  distance_meters int,
  duration_seconds int,
  estimated_fare_minor bigint not null default 0,
  offered_fare_minor bigint,
  final_fare_minor bigint,
  currency_code char(3) not null,
  currency_symbol text not null,
  currency_decimal_places int not null default 0,
  payment_method public.payment_method not null default 'cash',
  promo_code_id uuid,
  subscription_discount_minor bigint not null default 0,
  otp_required boolean not null default false,
  otp_code char(4),
  tracking_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  notes text,
  rating smallint check (rating between 1 and 5),
  accepted_at timestamptz,
  arrived_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.ride_stops (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides (id) on delete cascade,
  stop_type text not null check (stop_type in ('pickup', 'dropoff', 'waypoint')),
  sequence int not null default 0,
  address text not null,
  location geography(point, 4326) not null,
  contact_name text,
  contact_phone text
);

create table if not exists public.fare_bids (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides (id) on delete cascade,
  driver_id uuid not null references public.drivers (id),
  amount_minor bigint not null check (amount_minor > 0),
  currency_code char(3) not null,
  status public.bid_status not null default 'pending',
  counter_amount_minor bigint,
  message text,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (ride_id, driver_id)
);

create index if not exists idx_rides_rider on public.rides (rider_id, created_at desc);
create index if not exists idx_rides_driver on public.rides (driver_id, status);
create index if not exists idx_rides_market_status on public.rides (market_id, status);
create index if not exists idx_rides_tracking on public.rides (tracking_token);
create index if not exists idx_fare_bids_ride on public.fare_bids (ride_id, status);

drop trigger if exists trg_rides_updated on public.rides;
create trigger trg_rides_updated before update on public.rides
  for each row execute function public.set_updated_at();
drop trigger if exists trg_fare_bids_updated on public.fare_bids;
create trigger trg_fare_bids_updated before update on public.fare_bids
  for each row execute function public.set_updated_at();
-- ===== END 20260324100200_rides_bids.sql =====

-- ===== BEGIN 20260324100300_food_orders_merge.sql =====
-- Restaurants, menus, food orders, merge rules & batches

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id),
  market_id uuid not null references public.markets (id),
  zone_id uuid not null references public.delivery_zones (id),
  name text not null,
  slug text not null,
  description text,
  cover_url text,
  logo_url text,
  rating_avg numeric(3,2) not null default 5.00,
  rating_count int not null default 0,
  eta_minutes int not null default 30,
  is_open boolean not null default false,
  is_approved boolean not null default false,
  address text not null,
  location geography(point, 4326) not null,
  currency_code char(3) not null,
  currency_symbol text not null,
  currency_decimal_places int not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (market_id, slug)
);

create table if not exists public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  sort_order int not null default 0
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  category_id uuid references public.menu_categories (id) on delete set null,
  name text not null,
  description text,
  image_url text,
  price_minor bigint not null check (price_minor >= 0),
  is_available boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.menu_item_variants (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references public.menu_items (id) on delete cascade,
  name text not null,
  price_delta_minor bigint not null default 0,
  is_available boolean not null default true
);

create table if not exists public.menu_addons (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references public.menu_items (id) on delete cascade,
  name text not null,
  price_minor bigint not null default 0,
  is_available boolean not null default true
);

-- Deterministic merge rules (admin-configurable per market)
create table if not exists public.order_merge_rules (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null unique references public.markets (id) on delete cascade,
  enabled boolean not null default true,
  max_orders int not null default 3 check (max_orders between 2 and 8),
  max_pickup_distance_meters int not null default 0, -- 0 = same restaurant only
  max_dropoff_distance_meters int not null default 2500,
  max_wait_seconds int not null default 420,
  same_restaurant_only boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.merged_order_batches (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id),
  driver_id uuid references public.drivers (id),
  market_id uuid not null references public.markets (id),
  zone_id uuid not null references public.delivery_zones (id),
  status public.merged_batch_status not null default 'open',
  max_orders int not null,
  max_distance_meters int not null,
  pickup_location geography(point, 4326) not null,
  currency_code char(3) not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.food_orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  rider_id uuid not null references public.profiles (id),
  restaurant_id uuid not null references public.restaurants (id),
  driver_id uuid references public.drivers (id),
  market_id uuid not null references public.markets (id),
  zone_id uuid not null references public.delivery_zones (id),
  status public.food_order_status not null default 'pending',
  subtotal_minor bigint not null default 0,
  delivery_fee_minor bigint not null default 0,
  discount_minor bigint not null default 0,
  total_minor bigint not null default 0,
  currency_code char(3) not null,
  currency_symbol text not null,
  currency_decimal_places int not null default 0,
  payment_method public.payment_method not null default 'cash',
  promo_code_id uuid,
  subscription_free_delivery boolean not null default false,
  merged_batch_id uuid references public.merged_order_batches (id),
  delivery_address text not null,
  delivery_location geography(point, 4326) not null,
  notes text,
  tracking_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  estimated_delivery_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.food_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.food_orders (id) on delete cascade,
  menu_item_id uuid not null references public.menu_items (id),
  name text not null,
  quantity int not null check (quantity > 0),
  unit_price_minor bigint not null,
  variant_id uuid,
  variant_name text,
  addon_ids uuid[] not null default '{}',
  addon_names text[] not null default '{}',
  notes text,
  line_total_minor bigint not null
);

create index if not exists idx_restaurants_market on public.restaurants (market_id, is_approved, is_open);
create index if not exists idx_food_orders_rider on public.food_orders (rider_id, created_at desc);
create index if not exists idx_food_orders_restaurant on public.food_orders (restaurant_id, status);
create index if not exists idx_food_orders_batch on public.food_orders (merged_batch_id);
create index if not exists idx_restaurants_location on public.restaurants using gist (location);

drop trigger if exists trg_restaurants_updated on public.restaurants;
create trigger trg_restaurants_updated before update on public.restaurants
  for each row execute function public.set_updated_at();
drop trigger if exists trg_menu_items_updated on public.menu_items;
create trigger trg_menu_items_updated before update on public.menu_items
  for each row execute function public.set_updated_at();
drop trigger if exists trg_food_orders_updated on public.food_orders;
create trigger trg_food_orders_updated before update on public.food_orders
  for each row execute function public.set_updated_at();
drop trigger if exists trg_merge_rules_updated on public.order_merge_rules;
create trigger trg_merge_rules_updated before update on public.order_merge_rules
  for each row execute function public.set_updated_at();
drop trigger if exists trg_merged_batches_updated on public.merged_order_batches;
create trigger trg_merged_batches_updated before update on public.merged_order_batches
  for each row execute function public.set_updated_at();
-- ===== END 20260324100300_food_orders_merge.sql =====

-- ===== BEGIN 20260324100400_promos_subscriptions_wallet.sql =====
-- Promos, subscriptions, wallet, withdrawals

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type public.promo_discount_type not null,
  discount_value numeric(12,2) not null check (discount_value > 0),
  applies_to public.promo_applies_to not null default 'both',
  market_ids uuid[] not null default '{}',
  zone_ids uuid[] not null default '{}',
  max_total_uses int,
  max_uses_per_user int not null default 1,
  used_count int not null default 0,
  min_order_minor bigint,
  max_discount_minor bigint,
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  check (expires_at > starts_at)
);

create table if not exists public.promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references public.promo_codes (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  ride_id uuid references public.rides (id),
  food_order_id uuid references public.food_orders (id),
  discount_minor bigint not null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.rides
  drop constraint if exists rides_promo_code_id_fkey;
alter table public.rides
  add constraint rides_promo_code_id_fkey
  foreign key (promo_code_id) references public.promo_codes (id) on delete set null;

alter table public.food_orders
  drop constraint if exists food_orders_promo_code_id_fkey;
alter table public.food_orders
  add constraint food_orders_promo_code_id_fkey
  foreign key (promo_code_id) references public.promo_codes (id) on delete set null;

create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  interval public.subscription_interval not null,
  price_minor bigint not null check (price_minor >= 0),
  currency_code char(3) not null,
  currency_symbol text not null,
  currency_decimal_places int not null default 0,
  ride_discount_percent numeric(5,2) not null default 0 check (ride_discount_percent between 0 and 100),
  free_food_delivery boolean not null default false,
  free_delivery_max_orders_per_month int,
  market_ids uuid[] not null default '{}',
  features text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_id uuid not null references public.subscription_plans (id),
  status public.subscription_status not null default 'active',
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  free_delivery_used_this_period int not null default 0,
  external_ref text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  tx_type public.wallet_tx_type not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency_code char(3) not null,
  reason text not null,
  reference_type text,
  reference_id uuid,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers (id),
  amount_minor bigint not null check (amount_minor > 0),
  currency_code char(3) not null,
  status public.withdrawal_status not null default 'pending',
  payout_method text not null,
  payout_details jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_promo_code_active on public.promo_codes (is_active, expires_at);
create index if not exists idx_user_subs on public.user_subscriptions (user_id, status);
create index if not exists idx_wallet_user on public.wallet_transactions (user_id, created_at desc);

drop trigger if exists trg_user_subscriptions_updated on public.user_subscriptions;
create trigger trg_user_subscriptions_updated before update on public.user_subscriptions
  for each row execute function public.set_updated_at();
-- ===== END 20260324100400_promos_subscriptions_wallet.sql =====

-- ===== BEGIN 20260324100500_gamification_support_cms.sql =====
-- Driver gamification, support desk, CMS, app settings, KPI view

create table if not exists public.gamification_levels (
  level int primary key check (level > 0),
  title text not null,
  xp_required int not null check (xp_required >= 0)
);

create table if not exists public.gamification_badges (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  icon_url text,
  xp_reward int not null default 0,
  criteria_key text not null, -- e.g. trips_completed, deliveries_completed, rating_avg
  criteria_threshold numeric not null,
  is_active boolean not null default true
);

create table if not exists public.driver_gamification (
  driver_id uuid primary key references public.drivers (id) on delete cascade,
  xp int not null default 0 check (xp >= 0),
  level int not null default 1 references public.gamification_levels (level),
  trips_completed int not null default 0,
  deliveries_completed int not null default 0,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.driver_badges (
  driver_id uuid not null references public.drivers (id) on delete cascade,
  badge_id uuid not null references public.gamification_badges (id) on delete cascade,
  unlocked_at timestamptz not null default timezone('utc', now()),
  primary key (driver_id, badge_id)
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  user_id uuid not null references public.profiles (id),
  assignee_id uuid references public.profiles (id),
  subject text not null,
  status public.support_ticket_status not null default 'open',
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  related_type text check (related_type in ('ride', 'food_order', 'wallet', 'other')),
  related_id uuid,
  refund_status public.refund_status not null default 'none',
  refund_amount_minor bigint,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  sender_id uuid not null references public.profiles (id),
  body text not null,
  attachments text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.cms_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  body_markdown text not null default '',
  locale text not null default 'vi',
  is_published boolean not null default false,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default timezone('utc', now())
);

-- Deterministic ops KPIs (replaces AI city health / heatmap)
create or replace view public.v_market_kpis as
select
  m.id as market_id,
  m.name as market_name,
  m.currency_code,
  (select count(*) from public.rides r
     where r.market_id = m.id and r.status = 'completed'
       and r.completed_at >= date_trunc('day', timezone('utc', now()))) as rides_completed_today,
  (select count(*) from public.food_orders o
     where o.market_id = m.id and o.status = 'delivered'
       and o.updated_at >= date_trunc('day', timezone('utc', now()))) as orders_delivered_today,
  (select count(*) from public.drivers d
     where d.market_id = m.id and d.is_online = true) as drivers_online,
  (select count(*) from public.restaurants r
     where r.market_id = m.id and r.is_approved = true and r.is_open = true) as restaurants_open,
  coalesce((
    select round(
      100.0 * count(*) filter (where r.status = 'completed')
      / nullif(count(*) filter (where r.status in ('completed', 'cancelled')), 0),
      2
    )
    from public.rides r
    where r.market_id = m.id
      and r.created_at >= timezone('utc', now()) - interval '7 days'
  ), 0) as ride_fulfillment_rate_7d,
  coalesce((
    select sum(coalesce(r.final_fare_minor, 0))
    from public.rides r
    where r.market_id = m.id and r.status = 'completed'
      and r.completed_at >= date_trunc('day', timezone('utc', now()))
  ), 0) as ride_revenue_minor_today,
  coalesce((
    select sum(o.total_minor)
    from public.food_orders o
    where o.market_id = m.id and o.status = 'delivered'
      and o.updated_at >= date_trunc('day', timezone('utc', now()))
  ), 0) as food_revenue_minor_today
from public.markets m
where m.is_active = true;

drop trigger if exists trg_support_tickets_updated on public.support_tickets;
create trigger trg_support_tickets_updated before update on public.support_tickets
  for each row execute function public.set_updated_at();
drop trigger if exists trg_driver_gamification_updated on public.driver_gamification;
create trigger trg_driver_gamification_updated before update on public.driver_gamification
  for each row execute function public.set_updated_at();

-- Seed baseline levels & badges
insert into public.gamification_levels (level, title, xp_required) values
  (1, 'Tài xế mới', 0),
  (2, 'Tài xế bạc', 500),
  (3, 'Tài xế vàng', 1500),
  (4, 'Tài xế bạch kim', 4000),
  (5, 'Tài xế kim cương', 10000)
on conflict (level) do nothing;

insert into public.gamification_badges (slug, name, description, criteria_key, criteria_threshold, xp_reward)
values
  ('first_trip', 'Chuyến đầu tiên', 'Hoàn thành chuyến xe đầu tiên', 'trips_completed', 1, 50),
  ('trip_50', '50 chuyến', 'Hoàn thành 50 chuyến', 'trips_completed', 50, 200),
  ('delivery_10', '10 đơn giao', 'Hoàn thành 10 đơn đồ ăn', 'deliveries_completed', 10, 100),
  ('five_star', '5 sao', 'Giữ rating trung bình ≥ 4.8 với ≥ 20 đánh giá', 'rating_avg', 4.8, 150)
on conflict (slug) do nothing;

insert into public.app_settings (key, value) values
  ('branding', '{"name":"GOXE","primary":"#24B8C4","secondary":"#1BA8B5"}'::jsonb),
  ('payments', '{"stripe":true,"paypal":true,"razorpay":true,"myfatoorah":true,"wallet":true,"cash":true}'::jsonb),
  ('defaults', '{"locale":"vi","currency":"VND","timezone":"Asia/Ho_Chi_Minh"}'::jsonb)
on conflict (key) do nothing;
-- ===== END 20260324100500_gamification_support_cms.sql =====

-- ===== BEGIN 20260324100600_rpc_helpers.sql =====
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

-- (handle_new_user defined later — hardened version)
-- ===== END 20260324100600_rpc_helpers.sql =====

-- ===== BEGIN 20260324100700_rpc_rides_otp_bids.sql =====
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
-- ===== END 20260324100700_rpc_rides_otp_bids.sql =====

-- ===== BEGIN 20260324100800_rpc_promos_merge_city.sql =====
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
-- ===== END 20260324100800_rpc_promos_merge_city.sql =====

-- ===== BEGIN 20260324100900_triggers_gamification.sql =====
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
-- ===== END 20260324100900_triggers_gamification.sql =====

-- ===== BEGIN 20260324101000_rls_policies.sql =====
-- Row Level Security — least privilege, no AI tables

alter table public.profiles enable row level security;
alter table public.markets enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.vehicle_types enable row level security;
alter table public.city_pricing_templates enable row level security;
alter table public.drivers enable row level security;
alter table public.driver_documents enable row level security;
alter table public.rides enable row level security;
alter table public.ride_stops enable row level security;
alter table public.fare_bids enable row level security;
alter table public.restaurants enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.menu_item_variants enable row level security;
alter table public.menu_addons enable row level security;
alter table public.order_merge_rules enable row level security;
alter table public.merged_order_batches enable row level security;
alter table public.food_orders enable row level security;
alter table public.food_order_items enable row level security;
alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.user_subscriptions enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.withdrawal_requests enable row level security;
alter table public.gamification_levels enable row level security;
alter table public.gamification_badges enable row level security;
alter table public.driver_gamification enable row level security;
alter table public.driver_badges enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
alter table public.cms_pages enable row level security;
alter table public.app_settings enable row level security;
alter table public.intercity_routes enable row level security;

-- Profiles
drop policy if exists profiles_select_own_or_staff on public.profiles;
create policy profiles_select_own_or_staff on public.profiles for select
  using (id = auth.uid() or public.is_staff());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update
  using (id = auth.uid() or public.is_admin());

-- Public catalog
drop policy if exists markets_public_read on public.markets;
create policy markets_public_read on public.markets for select using (is_active or public.is_staff());
drop policy if exists zones_public_read on public.delivery_zones;
create policy zones_public_read on public.delivery_zones for select using (is_active or public.is_staff());
drop policy if exists vehicles_public_read on public.vehicle_types;
create policy vehicles_public_read on public.vehicle_types for select using (is_active or public.is_staff());
drop policy if exists routes_public_read on public.intercity_routes;
create policy routes_public_read on public.intercity_routes for select using (is_active or public.is_staff());
drop policy if exists plans_public_read on public.subscription_plans;
create policy plans_public_read on public.subscription_plans for select using (is_active or public.is_staff());
drop policy if exists cms_public_read on public.cms_pages;
create policy cms_public_read on public.cms_pages for select using (is_published or public.is_staff());
drop policy if exists settings_public_read on public.app_settings;
create policy settings_public_read on public.app_settings for select using (true);
drop policy if exists templates_admin on public.city_pricing_templates;
create policy templates_admin on public.city_pricing_templates for select using (public.is_admin());
drop policy if exists levels_public on public.gamification_levels;
create policy levels_public on public.gamification_levels for select using (true);
drop policy if exists badges_public on public.gamification_badges;
create policy badges_public on public.gamification_badges for select using (is_active);

-- Drivers
drop policy if exists drivers_read on public.drivers;
create policy drivers_read on public.drivers for select
  using (
    id = auth.uid()
    or public.is_staff()
    or exists (
      select 1 from public.rides r
      where r.driver_id = drivers.id
        and r.rider_id = auth.uid()
        and r.status in ('accepted', 'driver_arrived', 'in_progress')
    )
    or exists (
      select 1 from public.food_orders o
      where o.driver_id = drivers.id
        and o.rider_id = auth.uid()
        and o.status in ('accepted', 'preparing', 'ready', 'picked_up')
    )
  );
drop policy if exists drivers_update_self on public.drivers;
create policy drivers_update_self on public.drivers for update
  using (id = auth.uid() or public.is_admin());
drop policy if exists driver_docs_own on public.driver_documents;
create policy driver_docs_own on public.driver_documents for all
  using (driver_id = auth.uid() or public.is_staff())
  with check (driver_id = auth.uid() or public.is_staff());

-- Rides
drop policy if exists rides_select on public.rides;
create policy rides_select on public.rides for select using (
  rider_id = auth.uid()
  or driver_id = auth.uid()
  or public.is_staff()
  or status in ('searching', 'bidding')
);
drop policy if exists rides_insert_rider on public.rides;
create policy rides_insert_rider on public.rides for insert with check (rider_id = auth.uid());
drop policy if exists rides_update_participants on public.rides;
create policy rides_update_participants on public.rides for update using (
  rider_id = auth.uid() or driver_id = auth.uid() or public.is_staff()
);
drop policy if exists ride_stops_select on public.ride_stops;
create policy ride_stops_select on public.ride_stops for select using (
  exists (
    select 1 from public.rides r
    where r.id = ride_id
      and (r.rider_id = auth.uid() or r.driver_id = auth.uid() or public.is_staff()
           or r.status in ('searching', 'bidding'))
  )
);

-- Bids
drop policy if exists bids_select on public.fare_bids;
create policy bids_select on public.fare_bids for select using (
  driver_id = auth.uid()
  or exists (select 1 from public.rides r where r.id = ride_id and r.rider_id = auth.uid())
  or public.is_staff()
);
drop policy if exists bids_insert_driver on public.fare_bids;
create policy bids_insert_driver on public.fare_bids for insert with check (driver_id = auth.uid());
drop policy if exists bids_update on public.fare_bids;
create policy bids_update on public.fare_bids for update using (
  driver_id = auth.uid()
  or exists (select 1 from public.rides r where r.id = ride_id and r.rider_id = auth.uid())
  or public.is_staff()
);

-- Food
drop policy if exists restaurants_public on public.restaurants;
create policy restaurants_public on public.restaurants for select
  using (is_approved or owner_id = auth.uid() or public.is_staff());
drop policy if exists restaurants_owner_write on public.restaurants;
create policy restaurants_owner_write on public.restaurants for all
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());
drop policy if exists menu_public on public.menu_items;
create policy menu_public on public.menu_items for select using (true);
drop policy if exists menu_cat_public on public.menu_categories;
create policy menu_cat_public on public.menu_categories for select using (true);
drop policy if exists menu_var_public on public.menu_item_variants;
create policy menu_var_public on public.menu_item_variants for select using (true);
drop policy if exists menu_addon_public on public.menu_addons;
create policy menu_addon_public on public.menu_addons for select using (true);

drop policy if exists food_orders_select on public.food_orders;
create policy food_orders_select on public.food_orders for select using (
  rider_id = auth.uid()
  or driver_id = auth.uid()
  or public.is_staff()
  or exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid())
);
drop policy if exists food_orders_insert on public.food_orders;
create policy food_orders_insert on public.food_orders for insert with check (rider_id = auth.uid());
drop policy if exists food_orders_update on public.food_orders;
create policy food_orders_update on public.food_orders for update using (
  rider_id = auth.uid()
  or driver_id = auth.uid()
  or public.is_staff()
  or exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid())
);
drop policy if exists food_order_items_select on public.food_order_items;
create policy food_order_items_select on public.food_order_items for select using (
  exists (
    select 1 from public.food_orders o
    where o.id = order_id
      and (o.rider_id = auth.uid() or o.driver_id = auth.uid() or public.is_staff()
           or exists (select 1 from public.restaurants r where r.id = o.restaurant_id and r.owner_id = auth.uid()))
  )
);

drop policy if exists merge_rules_read on public.order_merge_rules;
create policy merge_rules_read on public.order_merge_rules for select using (true);
drop policy if exists merge_batches_select on public.merged_order_batches;
create policy merge_batches_select on public.merged_order_batches for select using (
  driver_id = auth.uid() or public.is_staff()
  or exists (
    select 1 from public.food_orders o
    where o.merged_batch_id = id and (o.rider_id = auth.uid() or o.driver_id = auth.uid())
  )
  or exists (
    select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid()
  )
);

-- Wallet / subs / promos
drop policy if exists promo_read_active on public.promo_codes;
create policy promo_read_active on public.promo_codes for select using (is_active or public.is_staff());
drop policy if exists promo_redemptions_own on public.promo_redemptions;
create policy promo_redemptions_own on public.promo_redemptions for select using (user_id = auth.uid() or public.is_staff());
drop policy if exists subs_own on public.user_subscriptions;
create policy subs_own on public.user_subscriptions for select using (user_id = auth.uid() or public.is_staff());
drop policy if exists wallet_own on public.wallet_transactions;
create policy wallet_own on public.wallet_transactions for select using (user_id = auth.uid() or public.is_staff());
drop policy if exists withdrawals_own on public.withdrawal_requests;
create policy withdrawals_own on public.withdrawal_requests for select using (driver_id = auth.uid() or public.is_staff());
drop policy if exists withdrawals_insert on public.withdrawal_requests;
create policy withdrawals_insert on public.withdrawal_requests for insert with check (driver_id = auth.uid());

-- Gamification
drop policy if exists driver_xp_read on public.driver_gamification;
create policy driver_xp_read on public.driver_gamification for select using (driver_id = auth.uid() or public.is_staff());
drop policy if exists driver_badges_read on public.driver_badges;
create policy driver_badges_read on public.driver_badges for select using (driver_id = auth.uid() or public.is_staff());

-- Support
drop policy if exists tickets_own on public.support_tickets;
create policy tickets_own on public.support_tickets for select using (user_id = auth.uid() or assignee_id = auth.uid() or public.is_staff());
drop policy if exists tickets_insert on public.support_tickets;
create policy tickets_insert on public.support_tickets for insert with check (user_id = auth.uid());
drop policy if exists tickets_update on public.support_tickets;
create policy tickets_update on public.support_tickets for update using (user_id = auth.uid() or public.is_staff());
drop policy if exists messages_select on public.support_messages;
create policy messages_select on public.support_messages for select using (
  exists (
    select 1 from public.support_tickets t
    where t.id = ticket_id and (t.user_id = auth.uid() or t.assignee_id = auth.uid() or public.is_staff())
  )
);
drop policy if exists messages_insert on public.support_messages;
create policy messages_insert on public.support_messages for insert with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.support_tickets t
    where t.id = ticket_id and (t.user_id = auth.uid() or t.assignee_id = auth.uid() or public.is_staff())
  )
);


-- Partner menu writes (restaurant owners)
drop policy if exists menu_items_owner_write on public.menu_items;
create policy menu_items_owner_write on public.menu_items for all
  using (
    exists (
      select 1 from public.restaurants r
      where r.id = restaurant_id and (r.owner_id = auth.uid() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.restaurants r
      where r.id = restaurant_id and (r.owner_id = auth.uid() or public.is_admin())
    )
  );
drop policy if exists menu_categories_owner_write on public.menu_categories;
create policy menu_categories_owner_write on public.menu_categories for all
  using (
    exists (
      select 1 from public.restaurants r
      where r.id = restaurant_id and (r.owner_id = auth.uid() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.restaurants r
      where r.id = restaurant_id and (r.owner_id = auth.uid() or public.is_admin())
    )
  );
drop policy if exists menu_variants_owner_write on public.menu_item_variants;
create policy menu_variants_owner_write on public.menu_item_variants for all
  using (
    exists (
      select 1 from public.menu_items mi
      join public.restaurants r on r.id = mi.restaurant_id
      where mi.id = menu_item_id and (r.owner_id = auth.uid() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.menu_items mi
      join public.restaurants r on r.id = mi.restaurant_id
      where mi.id = menu_item_id and (r.owner_id = auth.uid() or public.is_admin())
    )
  );
drop policy if exists menu_addons_owner_write on public.menu_addons;
create policy menu_addons_owner_write on public.menu_addons for all
  using (
    exists (
      select 1 from public.menu_items mi
      join public.restaurants r on r.id = mi.restaurant_id
      where mi.id = menu_item_id and (r.owner_id = auth.uid() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.menu_items mi
      join public.restaurants r on r.id = mi.restaurant_id
      where mi.id = menu_item_id and (r.owner_id = auth.uid() or public.is_admin())
    )
  );

-- Admin writes
drop policy if exists admin_write_markets on public.markets;
create policy admin_write_markets on public.markets for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_write_zones on public.delivery_zones;
create policy admin_write_zones on public.delivery_zones for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_write_vehicles on public.vehicle_types;
create policy admin_write_vehicles on public.vehicle_types for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_write_promos on public.promo_codes;
create policy admin_write_promos on public.promo_codes for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_write_plans on public.subscription_plans;
create policy admin_write_plans on public.subscription_plans for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_write_merge_rules on public.order_merge_rules;
create policy admin_write_merge_rules on public.order_merge_rules for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_write_settings on public.app_settings;
create policy admin_write_settings on public.app_settings for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_write_cms on public.cms_pages;
create policy admin_write_cms on public.cms_pages for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_write_templates on public.city_pricing_templates;
create policy admin_write_templates on public.city_pricing_templates for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_write_badges on public.gamification_badges;
create policy admin_write_badges on public.gamification_badges for all using (public.is_admin()) with check (public.is_admin());
-- ===== END 20260324101000_rls_policies.sql =====

-- ===== BEGIN 20260324101100_cron_and_seed_templates.sql =====
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
-- ===== END 20260324101100_cron_and_seed_templates.sql =====

-- ===== BEGIN 20260324101200_auth_realtime_publication.sql =====
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
    case
      when coalesce(nullif(new.raw_user_meta_data->>'market_id', ''), '') ~* '^[0-9a-f-]{36}$'
        then (new.raw_user_meta_data->>'market_id')::uuid
      else null
    end
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
-- ===== END 20260324101200_auth_realtime_publication.sql =====

-- ===== BEGIN 20260324101300_profiles_insert_own.sql =====
-- Allow authenticated users to insert their own profile row (fallback if trigger lags).
-- Primary path remains handle_new_user() SECURITY DEFINER trigger.

alter table public.profiles enable row level security;

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert
  with check (id = auth.uid());
-- ===== END 20260324101300_profiles_insert_own.sql =====

-- =============================================================================
-- Done. Verify:
--   select extname from pg_extension where extname in ('postgis','pgcrypto');
--   select tablename from pg_tables where schemaname='public' order by 1;
--   select * from pg_publication_tables where pubname='supabase_realtime';
-- Never put service_role keys in Expo / Vercel client env — anon + RLS only.
-- =============================================================================

-- ===== profiles insert own (20260324101300) =====
alter table public.profiles enable row level security;
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert
  with check (id = auth.uid());
