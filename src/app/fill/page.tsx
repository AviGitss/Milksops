import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card, Kpi, Pill, Dot, num } from "@/components/ui";
import { FillRunChart, HeadBiasChart } from "@/components/charts";
import type { BatchFillStat, HeadStat } from "@/lib/types";

export const dynamic = "force-dynamic";

function cpkTone(cpk: number | null) {
  if (cpk == null) return "neutral" as const;
  if (cpk >= 1.33) return "ok" as const;
  if (cpk >= 1.0) return "warn" as const;
  return "bad" as const;
}

export default async function FillPage({
  searchParams,
}: {
  searchParams: Promise<{ batch?: string }>;
}) {
  const sp = await searchParams;
  const since = new Date(Date.now() - 10 * 864e5).toISOString();

  const statRes = await supabase
    .from("v_batch_fill_stats")
    .select("*")
    .gte("started_at", since)
    .order("started_at", { ascending: false });

  const stats = (statRes.data ?? []) as BatchFillStat[];
  const withCpk = stats.filter((s) => s.cpk != null);
  const selected =
    stats.find((s) => s.batch_id === sp.batch) ??
    [...withCpk].sort((a, b) => Number(a.cpk) - Number(b.cpk))[0] ??
    stats[0];

  const [sampleRes, headRes] = await Promise.all([
    selected
      ? supabase
          .from("fill_samples")
          .select("sampled_at,net_weight_g,head_no")
          .eq("batch_id", selected.batch_id)
          .order("sampled_at")
      : Promise.resolve({ data: [] }),
    supabase.from("v_head_fill_stats").select("*"),
  ]);

  const nozzleRes = await supabase
    .from("v_nozzle_stats")
    .select(
      "machine_code,machine_name,machine_status,line_code,nozzle_code,nozzle_no,nozzle_status,last_calibrated_at,sku_code,fill_tol_g,n,mean_g,sd_g,bias_g,under_count",
    );

  type NozzleStat = {
    machine_code: string;
    machine_name: string;
    machine_status: string;
    line_code: string | null;
    nozzle_code: string;
    nozzle_no: number;
    nozzle_status: string;
    last_calibrated_at: string | null;
    sku_code: string;
    fill_tol_g: number;
    n: number;
    mean_g: number;
    sd_g: number | null;
    bias_g: number;
    under_count: number;
  };

  // Roll the per-SKU nozzle rows up to one row per physical nozzle.
  const nozzleRoll = Object.values(
    ((nozzleRes.data ?? []) as NozzleStat[]).reduce<
      Record<
        string,
        {
          nozzle_code: string;
          machine_code: string;
          machine_name: string;
          machine_status: string;
          line_code: string | null;
          nozzle_no: number;
          nozzle_status: string;
          last_calibrated_at: string | null;
          n: number;
          biasSum: number;
          tol: number;
          under: number;
        }
      >
    >((acc, r) => {
      const k = r.nozzle_code;
      acc[k] ??= {
        nozzle_code: r.nozzle_code,
        machine_code: r.machine_code,
        machine_name: r.machine_name,
        machine_status: r.machine_status,
        line_code: r.line_code,
        nozzle_no: r.nozzle_no,
        nozzle_status: r.nozzle_status,
        last_calibrated_at: r.last_calibrated_at,
        n: 0,
        biasSum: 0,
        tol: Number(r.fill_tol_g),
        under: 0,
      };
      acc[k].n += r.n;
      acc[k].biasSum += Number(r.bias_g) * r.n;
      acc[k].under += r.under_count;
      return acc;
    }, {}),
  )
    .map((x) => ({ ...x, bias: x.n ? x.biasSum / x.n : 0 }))
    .sort((a, b) => Math.abs(b.bias) - Math.abs(a.bias));

  const worstNozzles = nozzleRoll.slice(0, 12);
  const outOfTol = nozzleRoll.filter((x) => Math.abs(x.bias) > x.tol * 0.6);

  const samples = (sampleRes.data ?? []) as {
    sampled_at: string;
    net_weight_g: number;
    head_no: number;
  }[];

  const heads = (headRes.data ?? []) as HeadStat[];
  const headsForLine = heads.filter(
    (h) => h.line_code === selected?.line_code && h.sku_code === selected?.sku_code,
  );
  const headAgg = Object.values(
    heads.reduce<Record<number, { head: number; sum: number; n: number }>>((acc, h) => {
      acc[h.head_no] ??= { head: h.head_no, sum: 0, n: 0 };
      acc[h.head_no].sum += Number(h.bias_g) * h.n;
      acc[h.head_no].n += h.n;
      return acc;
    }, {}),
  )
    .map((h) => ({ head: `Head ${h.head}`, bias: h.sum / h.n }))
    .sort((a, b) => a.head.localeCompare(b.head, undefined, { numeric: true }));

  const headData =
    headsForLine.length >= 4
      ? headsForLine
          .map((h) => ({ head: `Head ${h.head_no}`, bias: Number(h.bias_g) }))
          .sort((a, b) => a.head.localeCompare(b.head, undefined, { numeric: true }))
      : headAgg;

  const avgCpk = withCpk.length
    ? withCpk.reduce((s, x) => s + Number(x.cpk), 0) / withCpk.length
    : 0;
  const held = stats.filter((s) => s.disposition === "hold").length;
  const giveaway = withCpk.reduce(
    (s, x) => s + (Number(x.mean_g) - Number(x.fill_target_g)) * x.n_samples,
    0,
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[24px] m-0">Fill Volume Control</h1>
        <p className="muted mt-1 mb-0 max-w-[860px]">
          The plant rejects a batch when a random weight check fails. This module
          replaces the random check with continuous statistical control: every
          checkweigher reading is an SPC point, capability is computed live per
          batch, and deviation is attributed to a specific filler head before the
          batch is complete.
        </p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <Kpi
          label="Mean Cpk (10 days)"
          value={num(avgCpk, 2)}
          tone={cpkTone(avgCpk)}
          note="Target ≥ 1.33 for legal-metrology confidence"
        />
        <Kpi
          label="Batches on hold"
          value={held}
          tone={held ? "bad" : "ok"}
          note={`of ${stats.length} batches`}
        />
        <Kpi
          label="Batches below Cpk 1.0"
          value={withCpk.filter((s) => Number(s.cpk) < 1).length}
          tone="warn"
          note="Rejection risk on random check"
        />
        <Kpi
          label="Nozzles out of tolerance"
          value={outOfTol.length}
          tone={outOfTol.length ? "bad" : "ok"}
          note={`of ${nozzleRoll.length} filling points across 70 machines`}
        />
        <Kpi
          label="Net over-fill giveaway"
          value={`${(giveaway / 1000).toFixed(1)} kg`}
          tone={giveaway > 0 ? "warn" : "ok"}
          note="Sampled basis — free milk given away"
        />
      </div>

      {selected && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card
            className="lg:col-span-2"
            title={`Run chart — ${selected.batch_code}`}
            subtitle={`${selected.product_name} · line ${selected.line_code} · target ${selected.fill_target_g} g ± ${selected.fill_tol_g} g`}
            right={
              <Pill tone={cpkTone(selected.cpk)}>Cpk {num(selected.cpk, 2)}</Pill>
            }
          >
            <FillRunChart
              data={samples.map((s) => ({
                t: new Date(s.sampled_at).toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
                w: Number(s.net_weight_g),
              }))}
              target={Number(selected.fill_target_g)}
              lsl={Number(selected.fill_target_g) - Number(selected.fill_tol_g)}
              usl={Number(selected.fill_target_g) + Number(selected.fill_tol_g)}
            />
            <div className="grid grid-cols-4 gap-3 mt-3 text-[12px]">
              <div>
                <div className="muted">Mean</div>
                <div className="mono">{num(selected.mean_g)} g</div>
              </div>
              <div>
                <div className="muted">Std dev</div>
                <div className="mono">{num(selected.sd_g, 3)} g</div>
              </div>
              <div>
                <div className="muted">Below LSL</div>
                <div className="mono">
                  {selected.under_count} / {selected.n_samples}
                </div>
              </div>
              <div>
                <div className="muted">Above USL</div>
                <div className="mono">
                  {selected.over_count} / {selected.n_samples}
                </div>
              </div>
            </div>
          </Card>

          <Card
            title="Deviation by filler head"
            subtitle="Mean deviation from target — isolates the mechanical cause"
          >
            <HeadBiasChart data={headData} tol={Number(selected.fill_tol_g)} />
            <p className="muted text-[12px] mt-3 mb-0">
              A head consistently outside the dashed limits is a nozzle or
              timing-valve fault, not a process problem — it is fixed at the
              machine, and the whole batch need not be rejected.
            </p>
          </Card>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="Worst-offending nozzles, plant-wide"
          subtitle="70 machines × 2 nozzles. Ranked by mean deviation from target — this is the maintenance queue, in order."
        >
          <div className="scroll" style={{ maxHeight: 340 }}>
            <table className="grid">
              <thead>
                <tr>
                  <th>Nozzle</th>
                  <th>Machine</th>
                  <th>Line</th>
                  <th>Samples</th>
                  <th>Mean deviation</th>
                  <th>Below LSL</th>
                  <th>Nozzle state</th>
                  <th>Last calibrated</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {worstNozzles.map((x) => {
                  const bad = Math.abs(x.bias) > x.tol;
                  const warn = Math.abs(x.bias) > x.tol * 0.6;
                  return (
                    <tr key={x.nozzle_code}>
                      <td className="mono">{x.nozzle_code}</td>
                      <td className="muted">{x.machine_name}</td>
                      <td>{x.line_code}</td>
                      <td className="mono">{x.n.toLocaleString("en-IN")}</td>
                      <td
                        className="mono"
                        style={{
                          fontWeight: 600,
                          color: bad ? "var(--bad)" : warn ? "var(--warn)" : undefined,
                        }}
                      >
                        {x.bias > 0 ? "+" : ""}
                        {x.bias.toFixed(2)} g
                      </td>
                      <td className="mono">{x.under}</td>
                      <td>
                        <Pill tone={x.nozzle_status === "ok" ? "ok" : "bad"}>
                          {x.nozzle_status}
                        </Pill>
                      </td>
                      <td className="mono muted">
                        {x.last_calibrated_at
                          ? new Date(x.last_calibrated_at).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                            })
                          : "—"}
                      </td>
                      <td>
                        <Pill tone={bad ? "bad" : warn ? "warn" : "ok"}>
                          {bad ? "recalibrate now" : warn ? "watch" : "in tolerance"}
                        </Pill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card
          title="Deviation by nozzle position"
          subtitle="Aggregated across all 70 machines — a systematic position bias is a machine-design issue, not a single valve"
        >
          <HeadBiasChart
            data={[1, 2].map((no) => {
              const rows = nozzleRoll.filter((x) => x.nozzle_no === no);
              const n = rows.reduce((s, r) => s + r.n, 0);
              return {
                head: `Nozzle ${no}`,
                bias: n ? rows.reduce((s, r) => s + r.bias * r.n, 0) / n : 0,
              };
            })}
            tol={Number(selected?.fill_tol_g ?? 5)}
          />
          <p className="muted text-[12px] mt-3 mb-0">
            Both positions sitting on target means the fault is machine-specific —
            work the list on the left. A whole position running light points at the
            filler design or the shared timing cam.
          </p>
        </Card>
      </div>

      <Card
        title="Batch capability register"
        subtitle="Click a batch to load its run chart. Disposition is derived from capability, not from a single spot check."
      >
        <div className="scroll" style={{ maxHeight: 460 }}>
          <table className="grid">
            <thead>
              <tr>
                <th>Batch</th>
                <th>Started</th>
                <th>Line</th>
                <th>Shift</th>
                <th>Product</th>
                <th>Target</th>
                <th>Mean</th>
                <th>SD</th>
                <th>n</th>
                <th>Out of spec</th>
                <th>Cpk</th>
                <th>Disposition</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr
                  key={s.batch_id}
                  style={{
                    background:
                      s.batch_id === selected?.batch_id ? "#f3effd" : undefined,
                  }}
                >
                  <td className="mono">
                    <Link href={`/fill?batch=${s.batch_id}`} style={{ color: "var(--brand-700)" }}>
                      {s.batch_code}
                    </Link>
                  </td>
                  <td className="mono muted">
                    {new Date(s.started_at).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td>{s.line_code}</td>
                  <td>{s.shift}</td>
                  <td>
                    <Dot hex={s.colour_hex} />
                    {s.product_name}
                  </td>
                  <td className="mono">{num(s.fill_target_g, 0)} g</td>
                  <td className="mono">{num(s.mean_g)}</td>
                  <td className="mono">{num(s.sd_g, 3)}</td>
                  <td className="mono">{s.n_samples}</td>
                  <td className="mono">{s.under_count + s.over_count}</td>
                  <td className="mono">
                    <Pill tone={cpkTone(s.cpk)}>{num(s.cpk, 2)}</Pill>
                  </td>
                  <td>
                    <Pill
                      tone={
                        s.disposition === "released"
                          ? "ok"
                          : s.disposition === "rework"
                            ? "warn"
                            : s.disposition === "hold"
                              ? "bad"
                              : "neutral"
                      }
                    >
                      {s.disposition}
                    </Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
