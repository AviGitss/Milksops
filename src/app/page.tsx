import Link from "next/link";
import { supabase, CARTON_UNIT_COST } from "@/lib/supabase";
import { Card, Kpi, Pill, inr, num } from "@/components/ui";
import type { BatchFillStat, Alert, CartonDaily } from "@/lib/types";

export const dynamic = "force-dynamic";

function tone(sev: string) {
  return sev === "critical" ? "bad" : sev === "warning" ? "warn" : "neutral";
}

export default async function Home() {
  const since = new Date(Date.now() - 7 * 864e5).toISOString();

  const [fillRes, alertRes, cartonRes, scanRes, qualRes] = await Promise.all([
    supabase
      .from("v_batch_fill_stats")
      .select("*")
      .gte("started_at", since)
      .order("started_at", { ascending: false }),
    supabase
      .from("alerts")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("v_carton_daily").select("*").order("txn_date", { ascending: false }).limit(7),
    supabase
      .from("dock_scans")
      .select("verdict,value_delta,scanned_at")
      .gte("scanned_at", since),
    supabase
      .from("quality_tests")
      .select("result,tested_at")
      .gte("tested_at", since),
  ]);

  const fills = (fillRes.data ?? []) as BatchFillStat[];
  const alerts = (alertRes.data ?? []) as Alert[];
  const cartons = (cartonRes.data ?? []) as CartonDaily[];
  const scans = scanRes.data ?? [];
  const quals = qualRes.data ?? [];

  const withCpk = fills.filter((f) => f.cpk != null);
  const avgCpk =
    withCpk.length > 0
      ? withCpk.reduce((s, f) => s + Number(f.cpk), 0) / withCpk.length
      : 0;
  const atRisk = withCpk.filter((f) => Number(f.cpk) < 1.0).length;

  const mismatches = scans.filter((s) => s.verdict === "mismatch");
  const leakage = mismatches.reduce(
    (s, m) => s + Math.abs(Number(m.value_delta || 0)),
    0,
  );

  const unaccounted = cartons.reduce((s, c) => s + Number(c.unaccounted || 0), 0);
  const damaged = cartons.reduce((s, c) => s + Number(c.damaged || 0), 0);

  const qFail = quals.filter((q) => q.result !== "pass").length;
  const qRate = quals.length ? (1 - qFail / quals.length) * 100 : 100;

  const openImpact = alerts.reduce(
    (s, a) => s + Number(a.est_impact_inr || 0),
    0,
  );

  const modules = [
    {
      href: "/fill",
      n: 1,
      title: "Fill Volume Control",
      problem: "Batches rejected on random weight checks",
      answer:
        "Every checkweigher reading becomes an SPC point, attributed to one of 140 nozzles across 70 machines. Weight-to-volume comes from the formula you set in Settings.",
      stat: `${atRisk} batches below Cpk 1.0 this week`,
    },
    {
      href: "/dock",
      n: 2,
      title: "Dock Crate Verification",
      problem: "Loaders swap high-value packets for low-value",
      answer:
        "Crate scanned against the dispatch plan at the gate. A mismatch is blocked and resolves to a loader, a truck number and a gate pass.",
      stat: `${mismatches.length} substitutions caught · ${inr(leakage)} value protected`,
    },
    {
      href: "/cartons",
      n: 3,
      title: "Carton Ledger",
      problem: "1 lakh cartons/day, damage untracked",
      answer:
        "Issue → use → damage → return balanced per shift with reason codes. Unaccounted cartons surface the same day, not at stock-take.",
      stat: `${unaccounted.toLocaleString("en-IN")} unaccounted over 7 days`,
    },
    {
      href: "/rfid",
      n: 3.5,
      title: "Carton RFID",
      problem: "Damaged cartons impossible to track by hand",
      answer:
        "A passive UHF tag on every carton, read at the store gate, the erector, the scrap bin and the dock. The ledger is built from what physically moved.",
      stat: "Portals live · middleware POSTs to /api/rfid/events",
    },
    {
      href: "/quality",
      n: 4,
      title: "Fat / SNF Monitor",
      problem: "Fat % complaints against declared spec",
      answer:
        "Analyser bridge or QA bench HMI — three-point sampling checked against each SKU's legal spec, with tanker intake traced back to the society.",
      stat: `${num(qRate, 1)}% of tests within spec`,
    },
    {
      href: "/scada",
      n: 5,
      title: "SCADA Bridge",
      problem: "Closed panel, no real-time access",
      answer:
        "Historian CSV exports are ingested and time-aligned to batches, so process tags can be correlated with fill and quality outcomes.",
      stat: "Read-only historian ingestion, no PLC write-back",
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[26px] m-0">Plant Command Centre</h1>
        <p className="muted mt-1 mb-0">
          Rolling 7-day view · {fills.length} batches · {scans.length} crate
          scans · {quals.length} quality tests
        </p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <Kpi
          label="Fill capability (Cpk)"
          value={num(avgCpk, 2)}
          tone={avgCpk >= 1.33 ? "ok" : avgCpk >= 1.0 ? "warn" : "bad"}
          note={`${atRisk} of ${withCpk.length} batches at risk`}
        />
        <Kpi
          label="Crate substitutions"
          value={mismatches.length}
          tone={mismatches.length ? "bad" : "ok"}
          note={`${inr(leakage)} value at stake`}
        />
        <Kpi
          label="Cartons unaccounted"
          value={unaccounted.toLocaleString("en-IN")}
          tone={unaccounted > 15000 ? "bad" : "warn"}
          note={`${inr(unaccounted * CARTON_UNIT_COST)} · ${damaged.toLocaleString("en-IN")} logged damaged`}
        />
        <Kpi
          label="Spec compliance"
          value={num(qRate, 1)}
          unit="%"
          tone={qRate >= 99 ? "ok" : qRate >= 96 ? "warn" : "bad"}
          note={`${qFail} out-of-spec results`}
        />
        <Kpi
          label="Open alerts"
          value={alerts.length}
          tone={alerts.length > 20 ? "bad" : "warn"}
          note={`${inr(openImpact)} estimated exposure`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {modules.map((m) => (
          <Link key={m.href} href={m.href}>
            <Card className="h-full hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="mono"
                  style={{
                    background: "#efeafb",
                    color: "var(--brand-700)",
                    borderRadius: 8,
                    padding: "2px 8px",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {m.n}
                </span>
                <h3 className="m-0 text-[15px]">{m.title}</h3>
              </div>
              <p className="text-[12.5px] m-0" style={{ color: "var(--bad)" }}>
                {m.problem}
              </p>
              <p className="text-[13px] mt-2 mb-3">{m.answer}</p>
              <div className="muted mono text-[11.5px]">{m.stat}</div>
            </Card>
          </Link>
        ))}
      </div>

      <Card
        title="Open alerts"
        subtitle="Every alert is traceable to a batch, crate or shift record"
        right={
          <Link href="/alerts" className="text-[12px]" style={{ color: "var(--brand-700)" }}>
            View all →
          </Link>
        }
      >
        <div className="scroll" style={{ maxHeight: 400 }}>
          <table className="grid">
            <thead>
              <tr>
                <th>Raised</th>
                <th>Module</th>
                <th>Severity</th>
                <th style={{ whiteSpace: "normal" }}>Alert</th>
                <th>Exposure</th>
              </tr>
            </thead>
            <tbody>
              {alerts.slice(0, 25).map((a) => (
                <tr key={a.id}>
                  <td className="mono muted">
                    {new Date(a.created_at).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td>
                    <Pill tone="neutral">{a.module}</Pill>
                  </td>
                  <td>
                    <Pill tone={tone(a.severity)}>{a.severity}</Pill>
                  </td>
                  <td style={{ whiteSpace: "normal", maxWidth: 620 }}>
                    <div style={{ fontWeight: 600 }}>{a.title}</div>
                    <div className="muted text-[12px]">{a.detail}</div>
                  </td>
                  <td className="mono">{inr(a.est_impact_inr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
