"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const REASONS = [
  "wet-carton",
  "erector-jam",
  "forklift-crush",
  "print-defect",
  "handling-tear",
  "supplier-defect",
];

export default function CartonEntry({
  plantId,
  cartonTypes,
  lines,
}: {
  plantId: string;
  cartonTypes: { id: string; code: string; name: string; unit_cost: number }[];
  lines: { id: string; code: string; name: string }[];
}) {
  const router = useRouter();
  const [type, setType] = useState<"damaged" | "used" | "issue" | "returned">(
    "damaged",
  );
  const [ctId, setCtId] = useState(cartonTypes[0]?.id ?? "");
  const [lineId, setLineId] = useState(lines[0]?.id ?? "");
  const [shift, setShift] = useState("A");
  const [qty, setQty] = useState(50);
  const [reason, setReason] = useState(REASONS[0]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.from("carton_txns").insert({
      plant_id: plantId,
      carton_type_id: ctId,
      line_id: lineId,
      txn_date: new Date().toISOString().slice(0, 10),
      shift,
      txn_type: type,
      qty,
      reason_code: type === "damaged" ? reason : null,
      recorded_by: "shift-supervisor",
      ref_no: type.toUpperCase().slice(0, 3) + "-" + Date.now().toString().slice(-6),
    });
    if (error) {
      setMsg("Could not record: " + error.message);
    } else {
      const cost = (cartonTypes.find((c) => c.id === ctId)?.unit_cost ?? 18.5) * qty;
      setMsg(
        `Recorded ${qty} cartons as ${type}${type === "damaged" ? ` (${reason})` : ""} — ₹${Math.round(cost).toLocaleString("en-IN")} booked to today's shift ${shift}.`,
      );
      router.refresh();
    }
    setBusy(false);
  }

  const field = "w-full border rounded-lg px-3 py-2 text-[13px] bg-white";
  const fs = { borderColor: "var(--line)" };

  return (
    <div>
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        <div>
          <label className="muted text-[11px] uppercase tracking-wider font-semibold">
            Movement
          </label>
          <select
            className={field}
            style={fs}
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
          >
            <option value="issue">Issued from store</option>
            <option value="used">Consumed on line</option>
            <option value="damaged">Damaged / scrapped</option>
            <option value="returned">Returned to store</option>
          </select>
        </div>
        <div>
          <label className="muted text-[11px] uppercase tracking-wider font-semibold">
            Carton type
          </label>
          <select className={field} style={fs} value={ctId} onChange={(e) => setCtId(e.target.value)}>
            {cartonTypes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="muted text-[11px] uppercase tracking-wider font-semibold">
            Line
          </label>
          <select className={field} style={fs} value={lineId} onChange={(e) => setLineId(e.target.value)}>
            {lines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.code} — {l.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="muted text-[11px] uppercase tracking-wider font-semibold">
            Quantity
          </label>
          <input
            type="number"
            className={field}
            style={fs}
            value={qty}
            min={1}
            onChange={(e) => setQty(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="muted text-[11px] uppercase tracking-wider font-semibold">
            {type === "damaged" ? "Reason code" : "Shift"}
          </label>
          {type === "damaged" ? (
            <select className={field} style={fs} value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          ) : (
            <select className={field} style={fs} value={shift} onChange={(e) => setShift(e.target.value)}>
              {["A", "B", "C"].map((s) => (
                <option key={s} value={s}>
                  Shift {s}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <button
        onClick={submit}
        disabled={busy}
        className="mt-4"
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
        {busy ? "Recording…" : "Record movement"}
      </button>

      {msg && <div className="mt-3 text-[13px]">{msg}</div>}
    </div>
  );
}
