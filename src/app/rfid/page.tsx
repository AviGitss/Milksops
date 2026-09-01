import { supabase, CARTON_UNIT_COST } from "@/lib/supabase";
import { Card, Kpi, Pill, inr } from "@/components/ui";
import { CartonChart, SimpleBar, STATUS } from "@/components/charts";
import RfidPanel from "@/components/RfidPanel";

export const dynamic = "force-dynamic";

export default async function RfidPage() {
  const [readerRes, dailyRes, tagRes, dmgRes] = await Promise.all([
    supabase.from("rfid_readers").select("*").order("zone").order("code"),
    supabase.from("v_rfid_carton_daily").select("*").order("day", { ascending: false }).limit(14),
    supabase.from("rfid_tags").select("status"),
    supabase
      .from("rfid_events")
      .select("reason_code")
      .eq("event_type", "damaged")
      .limit(4000),
  ]);

  const readers = (readerRes.data ?? []) as {
    id: string;
    code: string;
    name: string;
    location: string;
    zone: string;
    antenna_count: number;
    ip_address: string;
    protocol: string;
    status: string;
    last_seen_at: string | null;
  }[];
  const daily = ((dailyRes.data ?? []) as {
    day: string;
    issued: number;
    packed: number;
    damaged: number;
    dispatched: number;
    unaccounted: number;
  }[])
    .slice()
    .reverse();
  const tags = (tagRes.data ?? []) as { status: string }[];
  const dmg = (dmgRes.data ?? []) as { reason_code: string | null }[];

  const byStatus = tags.reduce<Record<string, number>>((a, t) => {
    a[t.status] = (a[t.status] || 0) + 1;
    return a;
  }, {});

  const totals = daily.reduce(
    (a, d) => ({
      issued: a.issued + Number(d.issued || 0),
      packed: a.packed + Number(d.packed || 0),
      damaged: a.damaged + Number(d.damaged || 0),
      unaccounted: a.unaccounted + Number(d.unaccounted || 0),
    }),
    { issued: 0, packed: 0, damaged: 0, unaccounted: 0 },
  );

  const byReason = Object.values(
    dmg.reduce<Record<string, { reason: string; qty: number }>>((a, d) => {
      const k = d.reason_code ?? "unspecified";
      a[k] ??= { reason: k, qty: 0 };
      a[k].qty += 1;
      return a;
    }, {}),
  ).sort((a, b) => b.qty - a.qty);

  const online = readers.filter((r) => r.status === "online").length;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[24px] m-0">Carton RFID</h1>
        <p className="muted mt-1 mb-0 max-w-[920px]">
          Every carton carries a passive UHF tag. Fixed portals read it at four
          points — the store issue gate, the line erector, the scrap bin and the
          dock — so the ledger is built from what physically moved rather than from
          a slip someone remembered to fill. A carton read at issue and never read
          again is the loss, and it surfaces the same shift.
        </p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <Kpi
          label="Readers online"
          value={`${online}/${readers.length}`}
          tone={online === readers.length ? "ok" : "warn"}
          note="Fixed portals across four zones"
        />
        <Kpi label="Tags read (14 days)" value={tags.length.toLocaleString("en-IN")} note="Commissioned cartons" />
        <Kpi
          label="Damaged"
          value={totals.damaged.toLocaleString("en-IN")}
          tone="warn"
          note={`${inr(totals.damaged * CARTON_UNIT_COST)} · read at the scrap bin`}
        />
        <Kpi
          label="Never read again"
          value={(byStatus.unaccounted ?? 0).toLocaleString("en-IN")}
          tone="bad"
          note="Issued but no pack, scrap or dispatch read"
        />
        <Kpi
          label="Reconciliation gap"
          value={totals.unaccounted.toLocaleString("en-IN")}
          tone={totals.unaccounted > 500 ? "bad" : "warn"}
          note="Issue − pack − damage, from reads alone"
        />
      </div>

      <Card
        title="Live read feed"
        subtitle="What the middleware is POSTing to /api/rfid/events right now"
      >
        <RfidPanel />
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="Carton flow reconstructed from reads"
          subtitle="Packed vs damaged vs never-read-again, per day"
        >
          <CartonChart
            data={daily.map((d) => ({
              day: new Date(d.day).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
              used: Number(d.packed || 0),
              damaged: Number(d.damaged || 0),
              unaccounted: Math.max(0, Number(d.unaccounted || 0)),
            }))}
          />
        </Card>
        <Card title="Damage reasons at the scrap reader" subtitle="Operator selects on the bin HMI">
          <SimpleBar
            data={byReason}
            xKey="reason"
            yKey="qty"
            label="Cartons"
            color={STATUS.warning}
            height={300}
          />
        </Card>
      </div>

      <Card
        title="Reader estate"
        subtitle="Fixed portals — commission a new one by adding a row and pointing its middleware at the ingest endpoint"
      >
        <table className="grid">
          <thead>
            <tr>
              <th>Reader</th>
              <th>Name</th>
              <th>Zone</th>
              <th>Location</th>
              <th>Antennas</th>
              <th>IP</th>
              <th>Protocol</th>
              <th>Last seen</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {readers.map((r) => (
              <tr key={r.id}>
                <td className="mono">{r.code}</td>
                <td>{r.name}</td>
                <td>
                  <Pill tone="neutral">{r.zone}</Pill>
                </td>
                <td className="muted">{r.location}</td>
                <td className="mono">{r.antenna_count}</td>
                <td className="mono">{r.ip_address}</td>
                <td className="mono">{r.protocol}</td>
                <td className="mono muted">
                  {r.last_seen_at
                    ? new Date(r.last_seen_at).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "never"}
                </td>
                <td>
                  <Pill tone={r.status === "online" ? "ok" : "bad"}>{r.status}</Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Tag lifecycle" subtitle="Where every commissioned tag currently sits">
        <div className="flex gap-3 flex-wrap">
          {Object.entries(byStatus)
            .sort((a, b) => b[1] - a[1])
            .map(([k, v]) => (
              <div
                key={k}
                className="rounded-xl px-4 py-3"
                style={{ background: "#faf8ff", border: "1px solid var(--line)", minWidth: 150 }}
              >
                <div className="muted text-[11px] uppercase tracking-wider font-semibold">{k}</div>
                <div className="mono" style={{ fontSize: 22, color: "var(--brand-700)" }}>
                  {v.toLocaleString("en-IN")}
                </div>
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
}
