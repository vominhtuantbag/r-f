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
create policy profiles_select_own_or_staff on public.profiles for select
  using (id = auth.uid() or public.is_staff());
create policy profiles_update_own on public.profiles for update
  using (id = auth.uid() or public.is_admin());

-- Public catalog
create policy markets_public_read on public.markets for select using (is_active or public.is_staff());
create policy zones_public_read on public.delivery_zones for select using (is_active or public.is_staff());
create policy vehicles_public_read on public.vehicle_types for select using (is_active or public.is_staff());
create policy routes_public_read on public.intercity_routes for select using (is_active or public.is_staff());
create policy plans_public_read on public.subscription_plans for select using (is_active or public.is_staff());
create policy cms_public_read on public.cms_pages for select using (is_published or public.is_staff());
create policy settings_public_read on public.app_settings for select using (true);
create policy templates_admin on public.city_pricing_templates for select using (public.is_admin());
create policy levels_public on public.gamification_levels for select using (true);
create policy badges_public on public.gamification_badges for select using (is_active);

-- Drivers
create policy drivers_read on public.drivers for select
  using (id = auth.uid() or public.is_staff());
create policy drivers_update_self on public.drivers for update
  using (id = auth.uid() or public.is_admin());
create policy driver_docs_own on public.driver_documents for all
  using (driver_id = auth.uid() or public.is_staff())
  with check (driver_id = auth.uid() or public.is_staff());

-- Rides
create policy rides_select on public.rides for select using (
  rider_id = auth.uid()
  or driver_id = auth.uid()
  or public.is_staff()
  or status in ('searching', 'bidding')
);
create policy rides_insert_rider on public.rides for insert with check (rider_id = auth.uid());
create policy rides_update_participants on public.rides for update using (
  rider_id = auth.uid() or driver_id = auth.uid() or public.is_staff()
);
create policy ride_stops_select on public.ride_stops for select using (
  exists (
    select 1 from public.rides r
    where r.id = ride_id
      and (r.rider_id = auth.uid() or r.driver_id = auth.uid() or public.is_staff()
           or r.status in ('searching', 'bidding'))
  )
);

-- Bids
create policy bids_select on public.fare_bids for select using (
  driver_id = auth.uid()
  or exists (select 1 from public.rides r where r.id = ride_id and r.rider_id = auth.uid())
  or public.is_staff()
);
create policy bids_insert_driver on public.fare_bids for insert with check (driver_id = auth.uid());
create policy bids_update on public.fare_bids for update using (
  driver_id = auth.uid()
  or exists (select 1 from public.rides r where r.id = ride_id and r.rider_id = auth.uid())
  or public.is_staff()
);

-- Food
create policy restaurants_public on public.restaurants for select
  using (is_approved or owner_id = auth.uid() or public.is_staff());
create policy restaurants_owner_write on public.restaurants for all
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());
create policy menu_public on public.menu_items for select using (true);
create policy menu_cat_public on public.menu_categories for select using (true);
create policy menu_var_public on public.menu_item_variants for select using (true);
create policy menu_addon_public on public.menu_addons for select using (true);

create policy food_orders_select on public.food_orders for select using (
  rider_id = auth.uid()
  or driver_id = auth.uid()
  or public.is_staff()
  or exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid())
);
create policy food_orders_insert on public.food_orders for insert with check (rider_id = auth.uid());
create policy food_orders_update on public.food_orders for update using (
  rider_id = auth.uid()
  or driver_id = auth.uid()
  or public.is_staff()
  or exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid())
);
create policy food_order_items_select on public.food_order_items for select using (
  exists (
    select 1 from public.food_orders o
    where o.id = order_id
      and (o.rider_id = auth.uid() or o.driver_id = auth.uid() or public.is_staff()
           or exists (select 1 from public.restaurants r where r.id = o.restaurant_id and r.owner_id = auth.uid()))
  )
);

create policy merge_rules_read on public.order_merge_rules for select using (true);
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
create policy promo_read_active on public.promo_codes for select using (is_active or public.is_staff());
create policy promo_redemptions_own on public.promo_redemptions for select using (user_id = auth.uid() or public.is_staff());
create policy subs_own on public.user_subscriptions for select using (user_id = auth.uid() or public.is_staff());
create policy wallet_own on public.wallet_transactions for select using (user_id = auth.uid() or public.is_staff());
create policy withdrawals_own on public.withdrawal_requests for select using (driver_id = auth.uid() or public.is_staff());
create policy withdrawals_insert on public.withdrawal_requests for insert with check (driver_id = auth.uid());

-- Gamification
create policy driver_xp_read on public.driver_gamification for select using (driver_id = auth.uid() or public.is_staff());
create policy driver_badges_read on public.driver_badges for select using (driver_id = auth.uid() or public.is_staff());

-- Support
create policy tickets_own on public.support_tickets for select using (user_id = auth.uid() or assignee_id = auth.uid() or public.is_staff());
create policy tickets_insert on public.support_tickets for insert with check (user_id = auth.uid());
create policy tickets_update on public.support_tickets for update using (user_id = auth.uid() or public.is_staff());
create policy messages_select on public.support_messages for select using (
  exists (
    select 1 from public.support_tickets t
    where t.id = ticket_id and (t.user_id = auth.uid() or t.assignee_id = auth.uid() or public.is_staff())
  )
);
create policy messages_insert on public.support_messages for insert with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.support_tickets t
    where t.id = ticket_id and (t.user_id = auth.uid() or t.assignee_id = auth.uid() or public.is_staff())
  )
);

-- Admin writes
create policy admin_write_markets on public.markets for all using (public.is_admin()) with check (public.is_admin());
create policy admin_write_zones on public.delivery_zones for all using (public.is_admin()) with check (public.is_admin());
create policy admin_write_vehicles on public.vehicle_types for all using (public.is_admin()) with check (public.is_admin());
create policy admin_write_promos on public.promo_codes for all using (public.is_admin()) with check (public.is_admin());
create policy admin_write_plans on public.subscription_plans for all using (public.is_admin()) with check (public.is_admin());
create policy admin_write_merge_rules on public.order_merge_rules for all using (public.is_admin()) with check (public.is_admin());
create policy admin_write_settings on public.app_settings for all using (public.is_admin()) with check (public.is_admin());
create policy admin_write_cms on public.cms_pages for all using (public.is_admin()) with check (public.is_admin());
create policy admin_write_templates on public.city_pricing_templates for all using (public.is_admin()) with check (public.is_admin());
create policy admin_write_badges on public.gamification_badges for all using (public.is_admin()) with check (public.is_admin());
