import { supabase } from "@/lib/supabase";
import { Card, Kpi, inr } from "@/components/ui";
import AlertTable from "@/components/AlertTable";
import type { Alert } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const { data } = await supabase
    .from("alerts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(800);

  const alerts = (data ?? []) as Alert[];
  const open = alerts.filter((a) => a.status === "open");
  const critical = open.filter((a) => a.severity === "critical");
  const exposure = open.reduce((s, a) => s + Number(a.est_impact_inr || 0), 0);

  const byModule = ["fill", "dock", "carton", "quality"].map((m) => ({
    m,
    n: open.filter((a) => a.module === m).length,
  }));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[24px] m-0">Alert Register</h1>
        <p className="muted mt-1 mb-0 max-w-[860px]">
          One queue for all four control loops. Every alert carries the record it
          came from and a rupee estimate, so the shift meeting works down a
          priced list rather than a feeling.
        </p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Kpi label="Open alerts" value={open.length} tone={open.length ? "bad" : "ok"} />
        <Kpi label="Critical" value={critical.length} tone={critical.length ? "bad" : "ok"} />
        <Kpi label="Open exposure" value={inr(exposure)} tone="warn" />
        <Kpi
          label="Busiest module"
          value={byModule.sort((a, b) => b.n - a.n)[0]?.m ?? "—"}
          tone="neutral"
          note={byModule.map((b) => `${b.m} ${b.n}`).join(" · ")}
        />
      </div>

      <Card title="All alerts" subtitle="Filter, review and acknowledge">
        <AlertTable alerts={alerts} />
      </Card>
    </div>
  );
}
