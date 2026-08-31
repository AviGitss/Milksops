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

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
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
