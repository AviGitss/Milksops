"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dot } from "@/components/ui";

type P = {
  id: string;
  sku_code: string;
  name: string;
  colour_hex: string | null;
  fat_min: number;
  fat_max: number;
  snf_min: number;
  snf_max: number;
};
type B = { id: string; batch_code: string; product_id: string };

const POINTS = ["raw", "silo", "standardised", "pasteuriser", "packed"];

export default function QualityHmi({
  products,
  batches,
}: {
  products: P[];
  batches: B[];
}) {
  const router = useRouter();
  const [sku, setSku] = useState(products[0]?.sku_code ?? "");
  const [batch, setBatch] = useState("");
  const [point, setPoint] = useState("packed");
  const [fat, setFat] = useState("");
  const [snf, setSnf] = useState("");
  const [temp, setTemp] = useState("");
  const [by, setBy] = useState("QA-Suma");
  const [method, setMethod] = useState("milko-analyser");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<null | { ok: boolean; text: string }>(null);

  const prod = products.find((p) => p.sku_code === sku);
  const fatN = Number(fat);
  const snfN = Number(snf);
  const verdict =
    !prod || !fat || !snf
      ? null
      : fatN < Number(prod.fat_min) - 0.05 || snfN < Number(prod.snf_min) - 0.05
        ? "fail"
        : fatN < Number(prod.fat_min) || snfN < Number(prod.snf_min)
          ? "marginal"
          : "pass";

  const skuBatches = batches.filter((b) => b.product_id === prod?.id).slice(0, 40);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setRes(null);
    const r = await fetch("/api/quality/tests", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "onk_demo_key_2026" },
      body: JSON.stringify({
        tests: [
          {
            sku,
            batchCode: batch || undefined,
            samplePoint: point,
            fatPct: fatN,
            snfPct: snfN,
            temperatureC: temp ? Number(temp) : undefined,
            method,
            testedBy: by,
            operatorId: by,
          },
        ],
      }),
    });
    const j = await r.json();
    setBusy(false);
    if (!j.ok) {
      setRes({ ok: false, text: j.error || "Could not record the test" });
      return;
    }
    setRes({
      ok: j.alertsRaised === 0,
      text:
        j.alertsRaised > 0
          ? `Recorded — and flagged. ${j.alertsRaised} alert raised against ${sku}; it is now on the shift's priced list.`
          : `Recorded. ${sku} at ${point}: fat ${fatN}%, SNF ${snfN}% — within spec.`,
    });
    setFat("");
    setSnf("");
    setTemp("");
    router.refresh();
  }

  const inp = "w-full border rounded-lg px-3 py-2 text-[13px] bg-white mt-1";
  const st = { borderColor: "var(--line)" };
  const lbl = "muted text-[11px] uppercase tracking-wider font-semibold";

  return (
    <form onSubmit={submit}>
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
        <div>
          <label className={lbl}>Product</label>
          <select
            className={inp}
            style={st}
            value={sku}
            onChange={(e) => {
              setSku(e.target.value);
              setBatch("");
            }}
          >
            {products.map((p) => (
              <option key={p.id} value={p.sku_code}>
                {p.sku_code} — {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={lbl}>Batch (optional)</label>
          <select className={inp} style={st} value={batch} onChange={(e) => setBatch(e.target.value)}>
            <option value="">— not linked —</option>
            {skuBatches.map((b) => (
              <option key={b.id} value={b.batch_code}>
                {b.batch_code}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={lbl}>Sample point</label>
          <select className={inp} style={st} value={point} onChange={(e) => setPoint(e.target.value)}>
            {POINTS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={lbl}>Method</label>
          <select className={inp} style={st} value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="milko-analyser">Milko-analyser</option>
            <option value="gerber">Gerber (manual)</option>
            <option value="inline-ir">Inline IR analyser</option>
          </select>
        </div>
        <div>
          <label className={lbl}>
            Fat % {prod && <span className="mono">(min {prod.fat_min})</span>}
          </label>
          <input
            className={inp}
            style={st}
            type="number"
            step="0.01"
            required
            value={fat}
            onChange={(e) => setFat(e.target.value)}
            placeholder="3.05"
          />
        </div>
        <div>
          <label className={lbl}>
            SNF % {prod && <span className="mono">(min {prod.snf_min})</span>}
          </label>
          <input
            className={inp}
            style={st}
            type="number"
            step="0.01"
            required
            value={snf}
            onChange={(e) => setSnf(e.target.value)}
            placeholder="8.62"
          />
        </div>
        <div>
          <label className={lbl}>Temperature °C</label>
          <input
            className={inp}
            style={st}
            type="number"
            step="0.1"
            value={temp}
            onChange={(e) => setTemp(e.target.value)}
            placeholder="5.1"
          />
        </div>
        <div>
          <label className={lbl}>Analyst</label>
          <input className={inp} style={st} value={by} onChange={(e) => setBy(e.target.value)} />
        </div>
      </div>

      <div className="flex items-center gap-4 mt-4 flex-wrap">
        <button
          type="submit"
          disabled={busy}
          style={{
            background: "var(--brand-700)",
            color: "#fff",
            padding: "9px 20px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? "Recording…" : "Record result"}
        </button>
        {prod && (
          <span className="muted text-[12px] flex items-center">
            <Dot hex={prod.colour_hex} />
            spec fat {prod.fat_min}–{prod.fat_max}% · SNF {prod.snf_min}–{prod.snf_max}%
          </span>
        )}
        {verdict && (
          <span
            className={`pill pill-${verdict === "pass" ? "ok" : verdict === "marginal" ? "warn" : "bad"}`}
          >
            will grade as {verdict}
          </span>
        )}
      </div>

      {res && (
        <div
          className="mt-4 rounded-xl p-3 text-[13px]"
          style={{
            background: res.ok ? "#e6f9f1" : "#ffe8ee",
            border: `1px solid ${res.ok ? "#a9e8ce" : "#ffc4d3"}`,
          }}
        >
          {res.text}
        </div>
      )}

      <p className="muted text-[12px] mt-3 mb-0">
        This panel posts to the same{" "}
        <span className="mono">/api/quality/tests</span> endpoint the analyser
        bridge uses — a keyed result and an instrument result are graded
        identically, and stored with how each arrived.
      </p>
    </form>
  );
}
