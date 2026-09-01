# Nandini DairyOps

Plant assurance for the Nandini (KMF) milk processing plant. Built by Open
Netrikkan. It sits **outside** the closed SCADA control system and closes the
gaps the plant manager raised.

| # | Problem stated | What the app does | Where |
|---|---|---|---|
| 1 | Fill volume inconsistent; batches rejected on random weight checks | Every checkweigher reading is an SPC point, attributed to one of **140 nozzles across 70 machines**. Cpk per batch; the maintenance queue is ranked by nozzle deviation. | `/fill` |
| 2 | Loaders substitute high-value packets for low-value at the dock | Crate verified against the dispatch plan at the gate. A mismatch is blocked and resolves to a loader, a **truck number**, a driver and a gate pass. | `/dock` |
| 3 | ~1 lakh cartons/day, damage and loss untrackable | **Passive UHF RFID** on every carton, read at the store gate, the line erector, the scrap bin and the dock. The ledger is built from what physically moved. | `/rfid`, `/cartons` |
| 4 | Fat % not matching declared spec | Three-point sampling graded against each SKU's legal spec, fed by an **analyser API** or the **QA bench HMI**. | `/quality` |
| 5 | SCADA panel closed, only historical data | Historian exports ingested read-only and time-aligned to batches. No PLC write-back. | `/scada` |

Plus: a **login screen that captures the lead**, **file upload for every input**,
and **settings** where each product's weight↔volume formula is entered.

## Stack

- Next.js 16 (App Router, server components) · Recharts · Tailwind 4
- Supabase / Postgres — SPC views (`v_batch_fill_stats`, `v_nozzle_stats`,
  `v_carton_daily`, `v_rfid_carton_daily`), RLS enabled
- Route handlers under `/api` for every device integration

## Pages

| Route | Purpose |
|---|---|
| `/login` | Lead capture + demo sign-in (gate enforced by `src/middleware.ts`) |
| `/` | Command centre — priced exposure across all control loops |
| `/fill` | Run charts, Cpk register, worst-offending nozzles across 70 machines |
| `/dock` | Truck assignment against the order sheet, gate scanner, mismatch ledger |
| `/cartons` | Shift ledger and daily reconciliation |
| `/rfid` | Live read feed, test stub, reader estate, tag lifecycle |
| `/quality` | Fat/SNF register, spec trend, QA bench HMI, tanker intake |
| `/scada` | Integration tiers, tag explorer, import log |
| `/uploads` | File upload for every input, with templates and validation |
| `/settings` | Weight↔volume formula per SKU, machine/nozzle register, API clients, leads |
| `/integrations` | Full interfacing guide — RFID middleware, analyser bridge, checkweigher |
| `/alerts` | One priced queue across all modules |

## APIs

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/rfid/events` | `x-api-key` | Carton tag reads from the reader middleware |
| GET | `/api/rfid/events` | — | Recent reads, for polling clients |
| POST | `/api/rfid/commission` | `x-api-key` | Register newly encoded tags |
| POST | `/api/rfid/simulate` | — | **Test stub** — lifecycle-correct dummy reads |
| POST | `/api/quality/tests` | `x-api-key` | Fat/SNF from analyser bridge or HMI |
| GET | `/api/quality/tests` | — | Read results back |
| POST | `/api/fill/samples` | `x-api-key` | Checkweigher stream / random-sample weights |
| POST | `/api/uploads` | — | Multipart CSV for any input |
| POST | `/api/leads` | — | Lead capture |
| GET | `/api/health` | — | Readiness probe |

See `/integrations` in the running app for wiring diagrams, a working Python
middleware loop for LLRP readers, and the serial-analyser bridge.

## Weight ↔ volume formula

`gross weight = (declared volume × density at Tref) + tare`, with density
corrected as `ρ(T) = ρref × (1 − k × (T − Tref))`. Editable per SKU in
`/settings`; saving recomputes the target and tolerance used by every SPC chart.

## Deploying

See [DEPLOY.md](./DEPLOY.md). The Supabase backend is already live and seeded.
