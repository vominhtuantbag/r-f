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

create trigger trg_user_subscriptions_updated before update on public.user_subscriptions
  for each row execute function public.set_updated_at();
