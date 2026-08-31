# Nandini DairyOps

Plant assurance application for the Nandini (KMF) milk processing plant. It sits
*outside* the closed SCADA control system and closes four operational gaps the
plant manager raised.

| # | Problem stated | What the app does |
|---|---|---|
| 1 | Pouch fill volume inconsistent; batches rejected on a random weight check | Every checkweigher reading becomes an SPC point. Cpk per batch, deviation per filler head, disposition derived from capability instead of one spot check. |
| 2 | Loaders substitute high-value (e.g. Full Cream / pink) packets with low-value (Toned / blue) at the dock | Crate barcode is verified against the dispatch order at the gate. Mismatch blocks the crate, names the loader, prices the variance. |
| 3 | ~1 lakh cartons/day, damage and loss untracked | Shift-level ledger: issue − used − damaged (with reason code) − returned = unaccounted, valued in rupees the same day. |
| 4 | Fat % complaints against declared spec | Three-point sampling (silo → pasteuriser → packed) against each SKU's FSSAI spec, with tanker intake traced back to the society. |
| 5 | SCADA panel closed, no real-time access; only historical exports available | Historian exports are ingested read-only and time-aligned to batches. All live controls run on independent instrumentation the plant owns. |

## Architecture

- **Next.js 16** (App Router, server components) on **Vercel**
- **Supabase / Postgres** — schema, SPC views (`v_batch_fill_stats`,
  `v_head_fill_stats`, `v_carton_daily`), RLS enabled
- **Recharts** for SPC run charts, head-bias and reconciliation views

The design deliberately assumes **no PLC write-back and no real-time SCADA
feed**. Tier 1 is historian ingestion (live today), Tier 2 is independent
instrumentation — checkweigher tap, dock gate scanner, carton store terminal,
inline fat analyser — and Tier 3 is an optional read-only OPC-UA tap if the OEM
ever opens one. The same tag map serves all three.

## Modules

| Route | Module |
|---|---|
| `/` | Command centre — priced exposure across all four loops |
| `/fill` | Fill volume control — run charts, Cpk register, filler-head bias |
| `/dock` | Dock verification — live gate scanner, mismatch ledger, loader attribution |
| `/cartons` | Carton ledger — shift entry form, daily reconciliation, damage root causes |
| `/quality` | Fat/SNF monitor — spec register, trend against the legal band, tanker intake |
| `/scada` | SCADA bridge — integration tiers, tag explorer, import log |
| `/alerts` | Alert register — filter and acknowledge |

## Running locally

```bash
npm install
cp .env.local.example .env.local   # add your Supabase URL + publishable key
npm run dev
```

Environment variables:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Data

The database is seeded with 21 days of representative plant data: 168 batches,
~8,000 checkweigher samples, ~5,000 crate scans, 21 days of carton movements and
a week of SCADA historian tags across five lines. Replace the seed with real
plant feeds — the schema and views are the production shape.

## Production hardening (before plant rollout)

- Move from the anonymous key to Supabase Auth with role-based policies
  (operator / QA / dock supervisor / plant manager)
- Make the checkweigher, gate scanner and carton terminal write through an edge
  function with a device key rather than the browser client
- Add the historian ingestion job as a scheduled function reading from the SFTP
  drop
