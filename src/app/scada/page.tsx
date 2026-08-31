import { supabase } from "@/lib/supabase";
import { Card, Kpi, Pill, num } from "@/components/ui";
import { SpecTrendChart } from "@/components/charts";

export const dynamic = "force-dynamic";

const TAG_INFO: Record<string, { label: string; unit: string; min: number; max: number }> = {
  PAST_TEMP: { label: "Pasteurisation temperature", unit: "°C", min: 72, max: 76 },
  HOLD_TIME: { label: "Holding time", unit: "s", min: 15, max: 18 },
  HOMO_PRESS: { label: "Homogeniser pressure", unit: "bar", min: 170, max: 200 },
  FILL_SPEED: { label: "Filler speed", unit: "pph", min: 4000, max: 9500 },
  STD_FAT_SP: { label: "Standardisation fat set-point", unit: "%", min: 1.5, max: 6.5 },
};

export default async function ScadaPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  const sp = await searchParams;

  const [importRes, tagRes] = await Promise.all([
    supabase.from("scada_imports").select("*").order("imported_at", { ascending: false }).limit(10),
    supabase.from("scada_readings").select("tag").limit(2000),
  ]);

  const imports = (importRes.data ?? []) as {
    id: string;
    file_name: string;
    source_system: string;
    imported_at: string;
    period_start: string;
    period_end: string;
    row_count: number;
    status: string;
    notes: string | null;
  }[];

  const tags = Array.from(new Set((tagRes.data ?? []).map((r) => r.tag))).sort();
  const tag = sp.tag && tags.includes(sp.tag) ? sp.tag : tags[0];

  const readRes = tag
    ? await supabase
        .from("scada_readings")
        .select("ts,value,unit")
        .eq("tag", tag)
        .order("ts")
        .limit(400)
    : { data: [] };

  const readings = (readRes.data ?? []) as { ts: string; value: number; unit: string }[];
  const suffix = tag?.split(".")[1] ?? "";
  const info = TAG_INFO[suffix] ?? { label: suffix, unit: "", min: 0, max: 0 };
  const values = readings.map((r) => Number(r.value));
  const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const breaches = values.filter((v) => v < info.min || v > info.max).length;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[24px] m-0">SCADA Bridge</h1>
        <p className="muted mt-1 mb-0 max-w-[900px]">
          The plant SCADA panel is closed and gives no real-time feed. DairyOps
          does not need one. Historian exports are ingested on a schedule and
          time-aligned to batch records, so process behaviour can be correlated
          with fill and composition outcomes after the fact — while the live
          controls in this system run on independent instrumentation the plant
          owns: the checkweigher tap, the dock gate scanner and the carton store
          terminal.
        </p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Historian files ingested"
          value={imports.length}
          note="Read-only, no write-back to the PLC"
        />
        <Kpi
          label="Tag readings held"
          value={imports.reduce((s, i) => s + i.row_count, 0).toLocaleString("en-IN")}
          note={`${tags.length} distinct tags mapped`}
        />
        <Kpi
          label={info.label}
          value={num(mean, 2)}
          unit={info.unit}
          tone={breaches === 0 ? "ok" : "warn"}
          note={`Mean over ${values.length} points`}
        />
        <Kpi
          label="Excursions on selected tag"
          value={breaches}
          tone={breaches ? "bad" : "ok"}
          note={`Window ${info.min}–${info.max} ${info.unit}`}
        />
      </div>

      <Card
        title="Integration path"
        subtitle="Three tiers, each deployable without touching the closed control system"
      >
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              t: "Tier 1 — Historian export (live today)",
              d: "Scheduled CSV/SQL dump from the SCADA historian, dropped to a watched folder or SFTP. Parsed, tag-mapped and time-aligned to batches. Zero vendor involvement.",
              s: "In use",
              tone: "ok" as const,
            },
            {
              t: "Tier 2 — Independent instrumentation",
              d: "Checkweigher serial/Ethernet tap, dock barcode gate, carton store terminal, inline fat analyser. Owned outright by the plant, so the live controls never depend on SCADA access.",
              s: "Recommended",
              tone: "warn" as const,
            },
            {
              t: "Tier 3 — OPC-UA read-only tap",
              d: "If and when the OEM opens a read-only OPC-UA endpoint or Modbus mirror, the same tag map switches from batch import to streaming with no change to the application.",
              s: "Future",
              tone: "neutral" as const,
            },
          ].map((x) => (
            <div key={x.t} className="rounded-xl p-4" style={{ background: "#faf8ff", border: "1px solid var(--line)" }}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <strong className="text-[13px]">{x.t}</strong>
                <Pill tone={x.tone}>{x.s}</Pill>
              </div>
              <p className="text-[12.5px] m-0 muted">{x.d}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card
        title="Tag explorer"
        subtitle="Historical process values from the closed panel, aligned to plant time"
        right={
          <form>
            <select
              name="tag"
              defaultValue={tag}
              className="border rounded-lg px-3 py-1.5 text-[12.5px] bg-white"
              style={{ borderColor: "var(--line)" }}
            >
              {tags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="ml-2 text-[12.5px]"
              style={{
                background: "var(--brand-700)",
                color: "#fff",
                padding: "6px 14px",
                borderRadius: 8,
                fontWeight: 600,
              }}
            >
              Load
            </button>
          </form>
        }
      >
        {readings.length > 0 && (
          <SpecTrendChart
            data={readings.map((r) => ({
              t: new Date(r.ts).toLocaleString("en-IN", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
              }),
              v: Number(r.value),
            }))}
            min={info.min}
            max={info.max}
            target={(info.min + info.max) / 2}
            unitLabel={info.label}
          />
        )}
        <p className="muted text-[12px] mt-3 mb-0">
          Showing <span className="mono">{tag}</span> — {info.label}. The shaded
          band is the process window; points outside it are candidate root causes
          for the fill and composition deviations flagged in the other modules.
        </p>
      </Card>

      <Card title="Import log" subtitle="Every ingestion is auditable — file, period covered, row count">
        <table className="grid">
          <thead>
            <tr>
              <th>Imported</th>
              <th>File</th>
              <th>Source</th>
              <th>Period covered</th>
              <th>Rows</th>
              <th>Status</th>
              <th style={{ whiteSpace: "normal" }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {imports.map((i) => (
              <tr key={i.id}>
                <td className="mono muted">
                  {new Date(i.imported_at).toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="mono">{i.file_name}</td>
                <td>{i.source_system}</td>
                <td className="mono muted">
                  {new Date(i.period_start).toLocaleDateString("en-IN")} →{" "}
                  {new Date(i.period_end).toLocaleDateString("en-IN")}
                </td>
                <td className="mono">{i.row_count.toLocaleString("en-IN")}</td>
                <td>
                  <Pill tone="ok">{i.status}</Pill>
                </td>
                <td style={{ whiteSpace: "normal" }} className="muted">
                  {i.notes}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
