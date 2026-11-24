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

create trigger trg_support_tickets_updated before update on public.support_tickets
  for each row execute function public.set_updated_at();
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
