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

create trigger trg_restaurants_updated before update on public.restaurants
  for each row execute function public.set_updated_at();
create trigger trg_menu_items_updated before update on public.menu_items
  for each row execute function public.set_updated_at();
create trigger trg_food_orders_updated before update on public.food_orders
  for each row execute function public.set_updated_at();
create trigger trg_merge_rules_updated before update on public.order_merge_rules
  for each row execute function public.set_updated_at();
create trigger trg_merged_batches_updated before update on public.merged_order_batches
  for each row execute function public.set_updated_at();
