# Deploying Nandini DairyOps

The Supabase backend is **already live and populated** — schema, views, seed data,
70 machines / 140 nozzles, RFID estate, formulas and leads. Nothing to set up
there. Only the web app needs deploying.

Project: `nandini-dairy-ops` · ref `uhjtptjyverhexfemegh` · region ap-south-1

## Run it locally (2 minutes)

```bash
npm install
npm run dev          # http://localhost:3000
```

`.env.local` is already in the zip with the Supabase URL and publishable key.

## Deploy to Vercel via GitHub (recommended)

```bash
git init                       # already initialised in the zip, with history
gh repo create nandini-dairyops --private --source=. --push
# or: create the repo on github.com, then
git remote add origin https://github.com/<you>/nandini-dairyops.git
git push -u origin main
```

Then in Vercel: **Add New → Project → import the repo**. Framework auto-detects
as Next.js. Add these environment variables (Production + Preview):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://uhjtptjyverhexfemegh.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_EMyZdvvxGnNjj5roTjIQ5g_4KxFQ3TL` |
| `INGEST_API_KEY` | `onk_demo_key_2026` (change this) |
| `SUPABASE_SERVICE_ROLE_KEY` | optional — server-side ingest, from the Supabase dashboard |

Every push to `main` then redeploys automatically.

## Or deploy straight from the CLI

```bash
npx vercel --prod
```

and add the same environment variables when prompted (or with `vercel env add`).

## Smoke test after deploy

```bash
BASE=https://<your-app>.vercel.app

curl $BASE/api/health

curl -X POST $BASE/api/rfid/simulate \
  -H 'Content-Type: application/json' -d '{"count":25}'

curl -X POST $BASE/api/quality/tests \
  -H 'x-api-key: onk_demo_key_2026' -H 'Content-Type: application/json' \
  -d '{"tests":[{"sku":"NTM500","samplePoint":"packed","fatPct":3.05,"snfPct":8.62}]}'
```

Then open `/` — the sign-in screen captures the lead, and everything behind it
should carry live data.

## Before a plant pilot

- Swap the shared `INGEST_API_KEY` for one key per device, checked against the
  `api_clients` table inside `authorise()` in `src/lib/api.ts`
- Delete or env-gate `src/app/api/rfid/simulate/route.ts` — a stub writing to the
  same tables as the readers must not exist in production
- Replace the lead-capture gate in `src/middleware.ts` with Supabase Auth and
  role-based RLS: operator / QA / dock supervisor / plant manager
- Add a uniqueness key on `(epc, reader_code, second)` so a middleware replay
  after a network drop cannot double-count cartons
- Rate-limit the ingest routes and add a dead-letter table for rejected rows
