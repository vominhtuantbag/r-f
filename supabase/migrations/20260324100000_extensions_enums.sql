-- Ride & Food — extensions + enums (no AI objects)

create extension if not exists "pgcrypto";
create extension if not exists "postgis";
create extension if not exists "pg_trgm";

-- Optional (enable in hosted Supabase dashboard if available)
-- create extension if not exists "pg_cron";

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
