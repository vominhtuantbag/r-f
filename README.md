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

## Vercel (Expo Web — monorepo)

For each Expo app project (`apps/rider`, `apps/driver`, `apps/partner`):

| Setting | Value |
|---|---|
| **Root Directory** | `apps/rider` (or `apps/driver` / `apps/partner`) |
| **Include files outside Root Directory** | **Yes** (required for `packages/*`) |
| **Install Command** | `cd ../.. && npm ci` |
| **Build Command** | `npx expo export --platform web` |
| **Output Directory** | `dist` |
| **Framework Preset** | Other |

`apps/*/vercel.json` already encodes install/build/output. `query-string` is a direct app dependency so Metro web export resolves under npm workspace hoisting.
