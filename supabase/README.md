# Supabase — Ride & Food

PostgreSQL + PostGIS schema, RLS, RPCs, triggers, and cron. **No AI objects.**

## Apply migrations

**Hosted Supabase (SQL Editor):** paste and run the single idempotent script:

[`supabase/CONSOLIDATED_SCHEMA.sql`](./CONSOLIDATED_SCHEMA.sql)

```bash
# Local CLI (ordered migrations — same schema)
npx supabase start
npx supabase db reset   # applies supabase/migrations/*
```

Regenerate the consolidated script after editing migrations:

```bash
python supabase/_build_consolidated.py
```

## Client wiring (`@ridefood/supabase`)

| Concern | Notes |
|---|---|
| Keys | **Anon only** via `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Never ship `service_role`. |
| Mock | `EXPO_PUBLIC_MOCK_MODE=true` (or missing/placeholder keys) → in-memory seed, no remote calls required. |
| Auth storage | SecureStore / AsyncStorage (native), `localStorage` (web), memory (mock). |
| Auth helpers | `signInWithPhonePassword`, `signUpRider`, `signInWithGoogle`, `signOut`, `onAuthStateChange` |
| Profiles | Trigger `on_auth_user_created` → `public.handle_new_user()` inserts `public.profiles` (+ driver rows). |
| Realtime | `subscribeRideStatus`, `subscribeRideBids`, `subscribeFoodOrder`, `subscribeMergedBatch`, `subscribeSupportChat`, `subscribeDriverLocation` |

## Key objects

| Area | Objects |
|---|---|
| Dual pricing | `markets.pricing_mode`, `estimate_ride_fare`, `place_fare_bid`, `accept_fare_bid` |
| OTP trip start | `transition_ride` (`start` + `p_otp`) |
| Promos | `promo_codes`, `validate_promo` |
| Multi-currency | `markets` / `delivery_zones` currency columns |
| City setup | `city_pricing_templates`, `apply_city_pricing_template` |
| KPIs | view `v_market_kpis` |
| Merge orders | `order_merge_rules`, `find_mergeable_orders`, `create_or_attach_merge_batch` |
| Gamification | triggers on ride complete / order delivered |
| Support | `support_tickets`, `support_messages` (+ Realtime) |
| Tracking | `track_ride_by_token`, `track_order_by_token` |
| Auth / RLS | `handle_new_user`, profiles/rides/bids/orders/chat policies (`*_rls_policies.sql`) |
| Realtime pub | `20260324101200_auth_realtime_publication.sql` |

## Edge Functions (Step 2)

Scaffold under `supabase/functions/` for payment webhooks, refunds, subscription billing.
