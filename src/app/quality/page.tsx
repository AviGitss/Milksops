import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card, Kpi, Pill, Dot, num } from "@/components/ui";
import { SpecTrendChart, SimpleBar, STATUS } from "@/components/charts";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

type QT = {
  id: string;
  sample_point: string;
  tested_at: string;
  fat_pct: number;
  snf_pct: number;
  result: string;
  tested_by: string | null;
  product_id: string;
  batch: { batch_code: string } | null;
};

export default async function QualityPage({
  searchParams,
}: {
  searchParams: Promise<{ sku?: string }>;
}) {
  const sp = await searchParams;
  const since = new Date(Date.now() - 21 * 864e5).toISOString();

  const [prodRes, qRes, tankerRes] = await Promise.all([
    supabase.from("products").select("*").eq("active", true).order("sku_code"),
    supabase
      .from("quality_tests")
      .select(
        "id,sample_point,tested_at,fat_pct,snf_pct,result,tested_by,product_id,batch:batch_id(batch_code)",
      )
      .gte("tested_at", since)
      .order("tested_at", { ascending: false })
      .limit(1500),
    supabase
      .from("tanker_receipts")
      .select("tanker_no,society_code,received_at,qty_litres,fat_pct,snf_pct,temperature_c,accepted")
      .order("received_at", { ascending: false })
      .limit(40),
  ]);

  const products = (prodRes.data ?? []) as Product[];
  const tests = (qRes.data ?? []) as unknown as QT[];
  const tankers = (tankerRes.data ?? []) as {
    tanker_no: string;
    society_code: string;
    received_at: string;
    qty_litres: number;
    fat_pct: number;
    snf_pct: number;
    temperature_c: number;
    accepted: boolean;
  }[];

  const bySku = products.map((p) => {
    const t = tests.filter((x) => x.product_id === p.id);
    const fails = t.filter((x) => x.result !== "pass");
    return {
      p,
      n: t.length,
      fails: fails.length,
      compliance: t.length ? ((t.length - fails.length) / t.length) * 100 : 100,
      meanFat: t.length ? t.reduce((s, x) => s + Number(x.fat_pct), 0) / t.length : 0,
      meanSnf: t.length ? t.reduce((s, x) => s + Number(x.snf_pct), 0) / t.length : 0,
    };
  });

  const selected =
    bySku.find((b) => b.p.sku_code === sp.sku) ??
    [...bySku].filter((b) => b.n > 0).sort((a, b) => a.compliance - b.compliance)[0] ??
    bySku[0];

  const selTests = tests
    .filter((t) => t.product_id === selected?.p.id)
    .slice()
    .reverse();

  const totalFails = tests.filter((t) => t.result !== "pass").length;
  const compliance = tests.length ? ((tests.length - totalFails) / tests.length) * 100 : 100;
  const shortfall = tests
    .filter((t) => t.result !== "pass")
    .reduce((s, t) => {
      const p = products.find((x) => x.id === t.product_id);
      return s + (p ? Math.max(0, Number(p.fat_min) - Number(t.fat_pct)) : 0);
    }, 0);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[24px] m-0">Fat &amp; SNF Compliance Monitor</h1>
        <p className="muted mt-1 mb-0 max-w-[860px]">
          A fat complaint is only answerable if the plant can show where the
          composition was lost. Every batch is sampled at three points — silo,
          pasteuriser outlet and finished pack — and checked against the declared
          FSSAI spec for that SKU, with the tanker intake that fed the silo traced
          back to the society.
        </p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Spec compliance (21 days)"
          value={num(compliance, 2)}
          unit="%"
          tone={compliance >= 99 ? "ok" : compliance >= 96 ? "warn" : "bad"}
          note={`${tests.length} tests · ${totalFails} out of spec`}
        />
        <Kpi
          label="SKUs below 98%"
          value={bySku.filter((b) => b.n > 0 && b.compliance < 98).length}
          tone="warn"
          note="Priority for standardisation review"
        />
        <Kpi
          label="Cumulative fat shortfall"
          value={num(shortfall, 2)}
          unit="pp"
          tone="bad"
          note="Sum of below-spec deviations — the consumer-complaint exposure"
        />
        <Kpi
          label="Tanker rejections"
          value={tankers.filter((t) => !t.accepted).length}
          tone="neutral"
          note={`of last ${tankers.length} receipts`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title={`Fat % against spec — ${selected?.p.name}`}
          subtitle={`Declared ${selected?.p.fat_target}% fat / ${selected?.p.snf_target}% SNF · shaded band is the legal window`}
          right={
            <Pill tone={selected && selected.compliance >= 99 ? "ok" : "warn"}>
              {num(selected?.compliance, 1)}% in spec
            </Pill>
          }
        >
          {selected && (
            <SpecTrendChart
              data={selTests.map((t) => ({
                t: new Date(t.tested_at).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                }),
                v: Number(t.fat_pct),
              }))}
              min={Number(selected.p.fat_min)}
              max={Number(selected.p.fat_max)}
              target={Number(selected.p.fat_target)}
              unitLabel="Fat"
            />
          )}
        </Card>
        <Card title="Compliance by SKU" subtitle="Click a row below to change the trend">
          <SimpleBar
            data={bySku
              .filter((b) => b.n > 0)
              .sort((a, b) => a.compliance - b.compliance)
              .slice(0, 8)
              .map((b) => ({ sku: b.p.sku_code, pct: Number(b.compliance.toFixed(1)) }))}
            xKey="sku"
            yKey="pct"
            unit="%"
            label="In spec"
            color={STATUS.good}
            height={280}
          />
        </Card>
      </div>

      <Card title="SKU specification register" subtitle="Declared spec vs 21-day measured average">
        <div className="scroll">
          <table className="grid">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Pack</th>
                <th>Product</th>
                <th>Fat spec</th>
                <th>Fat measured</th>
                <th>SNF spec</th>
                <th>SNF measured</th>
                <th>Tests</th>
                <th>Out of spec</th>
                <th>Compliance</th>
              </tr>
            </thead>
            <tbody>
              {bySku.map((b) => (
                <tr
                  key={b.p.id}
                  style={{
                    background: b.p.id === selected?.p.id ? "#f3effd" : undefined,
                  }}
                >
                  <td className="mono">
                    <Link href={`/quality?sku=${b.p.sku_code}`} style={{ color: "var(--brand-700)" }}>
                      {b.p.sku_code}
                    </Link>
                  </td>
                  <td>
                    <Dot hex={b.p.colour_hex} />
                    {b.p.pack_colour}
                  </td>
                  <td>{b.p.name}</td>
                  <td className="mono">≥ {num(b.p.fat_min, 1)}%</td>
                  <td
                    className="mono"
                    style={{
                      color: b.meanFat < Number(b.p.fat_min) ? "var(--bad)" : undefined,
                    }}
                  >
                    {b.n ? num(b.meanFat) + "%" : "—"}
                  </td>
                  <td className="mono">≥ {num(b.p.snf_min, 1)}%</td>
                  <td
                    className="mono"
                    style={{
                      color: b.meanSnf < Number(b.p.snf_min) ? "var(--bad)" : undefined,
                    }}
                  >
                    {b.n ? num(b.meanSnf) + "%" : "—"}
                  </td>
                  <td className="mono">{b.n}</td>
                  <td className="mono">{b.fails}</td>
                  <td>
                    <Pill
                      tone={
                        b.n === 0 ? "neutral" : b.compliance >= 99 ? "ok" : b.compliance >= 96 ? "warn" : "bad"
                      }
                    >
                      {b.n ? num(b.compliance, 1) + "%" : "no data"}
                    </Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Out-of-spec results"
          subtitle="Traceable to batch and sampling point — this is the answer to a customer complaint"
        >
          <div className="scroll" style={{ maxHeight: 340 }}>
            <table className="grid">
              <thead>
                <tr>
                  <th>Tested</th>
                  <th>Batch</th>
                  <th>Point</th>
                  <th>Fat</th>
                  <th>SNF</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {tests
                  .filter((t) => t.result !== "pass")
                  .slice(0, 40)
                  .map((t) => (
                    <tr key={t.id}>
                      <td className="mono muted">
                        {new Date(t.tested_at).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </td>
                      <td className="mono">{t.batch?.batch_code}</td>
                      <td>{t.sample_point}</td>
                      <td className="mono">{num(t.fat_pct)}%</td>
                      <td className="mono">{num(t.snf_pct)}%</td>
                      <td>
                        <Pill tone={t.result === "fail" ? "bad" : "warn"}>{t.result}</Pill>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card
          title="Raw milk intake"
          subtitle="Society-wise fat/SNF at the tanker bay — the upstream cause of most composition drift"
        >
          <div className="scroll" style={{ maxHeight: 340 }}>
            <table className="grid">
              <thead>
                <tr>
                  <th>Received</th>
                  <th>Tanker</th>
                  <th>Society</th>
                  <th>Qty</th>
                  <th>Fat</th>
                  <th>SNF</th>
                  <th>Temp</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {tankers.map((t, i) => (
                  <tr key={i}>
                    <td className="mono muted">
                      {new Date(t.received_at).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </td>
                    <td className="mono">{t.tanker_no}</td>
                    <td className="mono">{t.society_code}</td>
                    <td className="mono">{Number(t.qty_litres).toLocaleString("en-IN")} L</td>
                    <td className="mono">{num(t.fat_pct)}%</td>
                    <td className="mono">{num(t.snf_pct)}%</td>
                    <td className="mono">{num(t.temperature_c, 1)}°C</td>
                    <td>
                      <Pill tone={t.accepted ? "ok" : "bad"}>
                        {t.accepted ? "accepted" : "rejected"}
                      </Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
