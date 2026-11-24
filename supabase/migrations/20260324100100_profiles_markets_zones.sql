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

create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_markets_updated before update on public.markets
  for each row execute function public.set_updated_at();
create trigger trg_zones_updated before update on public.delivery_zones
  for each row execute function public.set_updated_at();
create trigger trg_vehicle_types_updated before update on public.vehicle_types
  for each row execute function public.set_updated_at();
create trigger trg_drivers_updated before update on public.drivers
  for each row execute function public.set_updated_at();
