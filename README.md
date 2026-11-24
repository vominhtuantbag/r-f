# Ride & Food (GOXE)

**100% TypeScript** · Expo (Web / Android / iOS) · Supabase · Vercel

AI features are **explicitly out of scope**. City setup uses pricing templates; ops metrics use SQL KPIs.

## Docs

- [Architecture & monorepo tree](docs/ARCHITECTURE.md)
- [Supabase migrations](supabase/README.md)

## Workspaces

```
apps/rider|driver|partner|admin|landing
packages/types|config|supabase|utils|ui
supabase/migrations|functions
```

`packages/api` is **legacy/transitional** — new code should use `@ridefood/supabase`.

## Step status

1. **Done** — Monorepo tree + Supabase schema/RLS/RPC/triggers/cron (no AI)
2. Next — Shared package polish + Edge Functions (`Continue step 2`)
3. Next — Expo apps (driver/partner/admin/landing) + Vercel deploy notes

## Local

```bash
cp .env.example .env
npm install
npx supabase start
npx supabase db reset
npm run rider
```
