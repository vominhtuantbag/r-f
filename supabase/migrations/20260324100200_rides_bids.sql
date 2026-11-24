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

create trigger trg_rides_updated before update on public.rides
  for each row execute function public.set_updated_at();
create trigger trg_fare_bids_updated before update on public.fare_bids
  for each row execute function public.set_updated_at();
