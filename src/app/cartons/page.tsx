import { supabase, CARTON_UNIT_COST } from "@/lib/supabase";
import { Card, Kpi, Pill, inr } from "@/components/ui";
import { CartonChart, SimpleBar, STATUS } from "@/components/charts";
import CartonEntry from "@/components/CartonEntry";
import type { CartonDaily } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CartonsPage() {
  const [dailyRes, dmgRes, ctRes, lineRes, plantRes] = await Promise.all([
    supabase.from("v_carton_daily").select("*").order("txn_date", { ascending: false }).limit(21),
    supabase
      .from("carton_txns")
      .select("reason_code,qty,txn_date")
      .eq("txn_type", "damaged")
      .gte("txn_date", new Date(Date.now() - 21 * 864e5).toISOString().slice(0, 10)),
    supabase.from("carton_types").select("id,code,name,unit_cost").order("code"),
    supabase.from("lines").select("id,code,name").order("code"),
    supabase.from("plants").select("id").limit(1).single(),
  ]);

  const daily = ((dailyRes.data ?? []) as CartonDaily[]).slice().reverse();
  const dmg = (dmgRes.data ?? []) as { reason_code: string | null; qty: number }[];

  const totals = daily.reduce(
    (a, d) => ({
      issued: a.issued + Number(d.issued || 0),
      used: a.used + Number(d.used || 0),
      damaged: a.damaged + Number(d.damaged || 0),
      returned: a.returned + Number(d.returned || 0),
      unaccounted: a.unaccounted + Number(d.unaccounted || 0),
    }),
    { issued: 0, used: 0, damaged: 0, returned: 0, unaccounted: 0 },
  );

  const dmgRate = totals.issued ? (totals.damaged / totals.issued) * 100 : 0;
  const unaccRate = totals.issued ? (totals.unaccounted / totals.issued) * 100 : 0;

  const byReason = Object.values(
    dmg.reduce<Record<string, { reason: string; qty: number }>>((acc, d) => {
      const k = d.reason_code ?? "unspecified";
      acc[k] ??= { reason: k, qty: 0 };
      acc[k].qty += Number(d.qty);
      return acc;
    }, {}),
  ).sort((a, b) => b.qty - a.qty);

  const chartData = daily.map((d) => ({
    day: new Date(d.txn_date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
    }),
    used: Number(d.used || 0),
    damaged: Number(d.damaged || 0),
    unaccounted: Math.max(0, Number(d.unaccounted || 0)),
  }));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[24px] m-0">Carton Ledger &amp; Loss Reconciliation</h1>
        <p className="muted mt-1 mb-0 max-w-[860px]">
          At a lakh cartons a day, loss hides in the gap between what the store
          issued and what the line actually used. This ledger closes that gap
          every shift: issue, consumption, damage with a reason code, and return
          must balance — whatever does not balance is shown as unaccounted, in
          rupees, the same day.
        </p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <Kpi
          label="Issued (21 days)"
          value={totals.issued.toLocaleString("en-IN")}
          note="From carton store to lines"
        />
        <Kpi
          label="Damaged"
          value={totals.damaged.toLocaleString("en-IN")}
          tone={dmgRate > 2 ? "bad" : "warn"}
          note={`${dmgRate.toFixed(2)}% of issue · ${inr(totals.damaged * CARTON_UNIT_COST)}`}
        />
        <Kpi
          label="Unaccounted"
          value={totals.unaccounted.toLocaleString("en-IN")}
          tone={unaccRate > 3 ? "bad" : "warn"}
          note={`${unaccRate.toFixed(2)}% of issue · ${inr(totals.unaccounted * CARTON_UNIT_COST)}`}
        />
        <Kpi
          label="Returned to store"
          value={totals.returned.toLocaleString("en-IN")}
          tone="ok"
          note="Excess issue recovered"
        />
        <Kpi
          label="Annualised exposure"
          value={inr(((totals.damaged + totals.unaccounted) / 21) * 365 * CARTON_UNIT_COST)}
          tone="bad"
          note="At the current daily loss rate"
        />
      </div>

      <Card
        title="Shift entry — carton movement"
        subtitle="The supervisor records here instead of on a paper slip; the reconciliation below updates immediately."
      >
        <CartonEntry
          plantId={plantRes.data?.id ?? ""}
          cartonTypes={(ctRes.data ?? []) as { id: string; code: string; name: string; unit_cost: number }[]}
          lines={(lineRes.data ?? []) as { id: string; code: string; name: string }[]}
        />
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="Daily carton flow"
          subtitle="Consumed vs damaged vs unaccounted against each day's issue"
        >
          <CartonChart data={chartData} />
        </Card>
        <Card title="Damage by root cause" subtitle="Where the corrective action belongs">
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

      <Card title="Daily reconciliation" subtitle="Issue − used − damaged − returned = unaccounted">
        <div className="scroll" style={{ maxHeight: 420 }}>
          <table className="grid">
            <thead>
              <tr>
                <th>Date</th>
                <th>Received</th>
                <th>Issued</th>
                <th>Used</th>
                <th>Damaged</th>
                <th>Returned</th>
                <th>Unaccounted</th>
                <th>Value at risk</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {daily
                .slice()
                .reverse()
                .map((d) => {
                  const un = Number(d.unaccounted || 0);
                  return (
                    <tr key={d.txn_date}>
                      <td className="mono">
                        {new Date(d.txn_date).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "2-digit",
                        })}
                      </td>
                      <td className="mono">{Number(d.received || 0).toLocaleString("en-IN")}</td>
                      <td className="mono">{Number(d.issued || 0).toLocaleString("en-IN")}</td>
                      <td className="mono">{Number(d.used || 0).toLocaleString("en-IN")}</td>
                      <td className="mono">{Number(d.damaged || 0).toLocaleString("en-IN")}</td>
                      <td className="mono">{Number(d.returned || 0).toLocaleString("en-IN")}</td>
                      <td className="mono" style={{ fontWeight: 600 }}>
                        {un.toLocaleString("en-IN")}
                      </td>
                      <td className="mono">{inr(un * CARTON_UNIT_COST)}</td>
                      <td>
                        <Pill tone={un > 4000 ? "bad" : un > 1500 ? "warn" : "ok"}>
                          {un > 4000 ? "investigate" : un > 1500 ? "review" : "balanced"}
                        </Pill>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
