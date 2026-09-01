"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Pill, Dot } from "@/components/ui";

export type FormulaRow = {
  id: string;
  product_id: string;
  declared_volume_ml: number;
  density_g_per_ml: number;
  tare_pack_g: number;
  tolerance_pct: number;
  temp_ref_c: number;
  temp_coeff_per_c: number;
  formula_note: string | null;
  updated_at: string;
  sku_code: string;
  name: string;
  colour_hex: string | null;
  fill_target_g: number;
  fill_tol_g: number;
};

export default function FormulaEditor({ rows }: { rows: FormulaRow[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<Record<string, Partial<FormulaRow>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const val = (r: FormulaRow, k: keyof FormulaRow) =>
    (edit[r.id]?.[k] as number | undefined) ?? (r[k] as number);

  const target = (r: FormulaRow) =>
    Number(val(r, "declared_volume_ml")) * Number(val(r, "density_g_per_ml")) +
    Number(val(r, "tare_pack_g"));

  const set = (r: FormulaRow, k: keyof FormulaRow, v: string) =>
    setEdit({ ...edit, [r.id]: { ...edit[r.id], [k]: Number(v) } });

  async function save(r: FormulaRow) {
    setBusy(r.id);
    setMsg(null);
    const patch = {
      declared_volume_ml: val(r, "declared_volume_ml"),
      density_g_per_ml: val(r, "density_g_per_ml"),
      tare_pack_g: val(r, "tare_pack_g"),
      tolerance_pct: val(r, "tolerance_pct"),
      temp_ref_c: val(r, "temp_ref_c"),
      temp_coeff_per_c: val(r, "temp_coeff_per_c"),
      updated_by: "settings-ui",
      updated_at: new Date().toISOString(),
    };
    const a = await supabase.from("fill_formulas").update(patch).eq("id", r.id);
    const newTarget = Number(target(r).toFixed(2));
    const b = await supabase
      .from("products")
      .update({
        fill_target_g: newTarget,
        fill_tol_g: Number(((newTarget * Number(val(r, "tolerance_pct"))) / 100).toFixed(2)),
      })
      .eq("id", r.product_id);
    setBusy(null);
    if (a.error || b.error) {
      setMsg(`Could not save ${r.sku_code}: ${(a.error || b.error)!.message}`);
      return;
    }
    setMsg(
      `${r.sku_code} saved — target gross weight is now ${newTarget.toFixed(2)} g. Every SPC chart and capability figure recomputes from this.`,
    );
    setEdit({ ...edit, [r.id]: {} });
    router.refresh();
  }

  const inp = "border rounded-md px-2 py-1 text-[12.5px] bg-white mono";
  const st = { borderColor: "var(--line)", width: 92 };

  return (
    <div>
      <div
        className="rounded-xl p-4 mb-4 text-[12.5px]"
        style={{ background: "#faf8ff", border: "1px solid var(--line)" }}
      >
        <strong>Gross weight = (declared volume × density at reference temp) + tare</strong>
        <div className="muted mt-1">
          Density is corrected to the measured pack temperature as{" "}
          <span className="mono">ρ(T) = ρref × (1 − k × (T − Tref))</span>. The checkweigher
          measures gross weight; this formula is what turns that into the volume the
          consumer is entitled to, and it sets the target and limits used by the SPC
          charts on <em>Fill Control</em>. Change it here and the whole module follows.
        </div>
      </div>

      {msg && (
        <div
          className="rounded-lg px-3 py-2 text-[12.5px] mb-3"
          style={{ background: "#e6f9f1", color: "#067a55" }}
        >
          {msg}
        </div>
      )}

      <div className="scroll">
        <table className="grid">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product</th>
              <th>Declared vol (ml)</th>
              <th>Density (g/ml)</th>
              <th>Tare (g)</th>
              <th>Tolerance (%)</th>
              <th>T ref (°C)</th>
              <th>k / °C</th>
              <th>Target gross (g)</th>
              <th>Limits (g)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const t = target(r);
              const tol = (t * Number(val(r, "tolerance_pct"))) / 100;
              const dirty = Object.keys(edit[r.id] ?? {}).length > 0;
              return (
                <tr key={r.id} style={{ background: dirty ? "#fffbf0" : undefined }}>
                  <td className="mono">{r.sku_code}</td>
                  <td>
                    <Dot hex={r.colour_hex} />
                    {r.name}
                  </td>
                  <td>
                    <input className={inp} style={st} type="number" step="1"
                      value={val(r, "declared_volume_ml")}
                      onChange={(e) => set(r, "declared_volume_ml", e.target.value)} />
                  </td>
                  <td>
                    <input className={inp} style={st} type="number" step="0.0001"
                      value={val(r, "density_g_per_ml")}
                      onChange={(e) => set(r, "density_g_per_ml", e.target.value)} />
                  </td>
                  <td>
                    <input className={inp} style={st} type="number" step="0.01"
                      value={val(r, "tare_pack_g")}
                      onChange={(e) => set(r, "tare_pack_g", e.target.value)} />
                  </td>
                  <td>
                    <input className={inp} style={st} type="number" step="0.05"
                      value={val(r, "tolerance_pct")}
                      onChange={(e) => set(r, "tolerance_pct", e.target.value)} />
                  </td>
                  <td>
                    <input className={inp} style={st} type="number" step="0.5"
                      value={val(r, "temp_ref_c")}
                      onChange={(e) => set(r, "temp_ref_c", e.target.value)} />
                  </td>
                  <td>
                    <input className={inp} style={st} type="number" step="0.00001"
                      value={val(r, "temp_coeff_per_c")}
                      onChange={(e) => set(r, "temp_coeff_per_c", e.target.value)} />
                  </td>
                  <td className="mono" style={{ fontWeight: 600 }}>
                    {t.toFixed(2)}
                  </td>
                  <td className="mono muted">
                    {(t - tol).toFixed(1)} – {(t + tol).toFixed(1)}
                  </td>
                  <td>
                    {dirty ? (
                      <button
                        onClick={() => save(r)}
                        disabled={busy === r.id}
                        className="text-[12px]"
                        style={{
                          background: "var(--brand-700)",
                          color: "#fff",
                          borderRadius: 8,
                          padding: "4px 12px",
                          fontWeight: 600,
                        }}
                      >
                        {busy === r.id ? "…" : "Save"}
                      </button>
                    ) : (
                      <Pill tone="ok">set</Pill>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
