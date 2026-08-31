"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Dot } from "@/components/ui";

type P = {
  id: string;
  sku_code: string;
  name: string;
  colour_hex: string | null;
  pack_colour: string | null;
  mrp: number;
};
type Loader = { id: string; name: string; code: string };
type Order = {
  id: string;
  order_code: string;
  dock_no: string | null;
  distributor: string | null;
  planned: { product_id: string; crates_planned: number }[];
};

export default function ScanVerifier({
  orders,
  products,
  loaders,
}: {
  orders: Order[];
  products: P[];
  loaders: Loader[];
}) {
  const router = useRouter();
  const [orderId, setOrderId] = useState(orders[0]?.id ?? "");
  const [expectedId, setExpectedId] = useState(
    orders[0]?.planned[0]?.product_id ?? "",
  );
  const [scannedId, setScannedId] = useState(
    orders[0]?.planned[0]?.product_id ?? "",
  );
  const [loaderId, setLoaderId] = useState(loaders[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<null | {
    ok: boolean;
    msg: string;
    detail: string;
  }>(null);

  const order = orders.find((o) => o.id === orderId);
  const planned = order?.planned ?? [];
  const byId = (id: string) => products.find((p) => p.id === id);

  async function submit() {
    if (!order || !expectedId || !scannedId) return;
    setBusy(true);
    setResult(null);

    const exp = byId(expectedId)!;
    const scn = byId(scannedId)!;
    const mismatch = exp.id !== scn.id;
    const delta = (Number(scn.mrp) - Number(exp.mrp)) * 24;
    const barcode =
      "CR" +
      new Date().toISOString().slice(2, 10).replace(/-/g, "") +
      Math.floor(10000 + Math.random() * 89999);

    const { data: scan, error } = await supabase
      .from("dock_scans")
      .insert({
        order_id: order.id,
        crate_barcode: barcode,
        expected_product_id: exp.id,
        scanned_product_id: scn.id,
        loader_id: loaderId || null,
        dock_no: order.dock_no,
        verdict: mismatch ? "mismatch" : "ok",
        value_delta: mismatch ? delta : 0,
        note: mismatch ? "Blocked at gate scanner — SKU/colour mismatch" : null,
      })
      .select("id")
      .single();

    if (error) {
      setResult({ ok: false, msg: "Scan failed", detail: error.message });
      setBusy(false);
      return;
    }

    if (mismatch) {
      const loaderName = loaders.find((l) => l.id === loaderId)?.name ?? "unknown";
      await supabase.from("alerts").insert({
        module: "dock",
        severity: "critical",
        title: `Crate substitution blocked at dock ${order.dock_no ?? "-"}`,
        detail: `Expected ${exp.name} (${exp.pack_colour}), scanned ${scn.name} (${scn.pack_colour}). Loader ${loaderName}. Crate ${barcode}.`,
        ref_id: scan?.id,
        status: "open",
        est_impact_inr: Math.abs(delta),
      });
      setResult({
        ok: false,
        msg: "LOAD BLOCKED",
        detail: `${scn.pack_colour} ${scn.name} scanned where ${exp.pack_colour} ${exp.name} was planned. Crate ${barcode} held; ₹${Math.round(Math.abs(delta)).toLocaleString("en-IN")} value variance flagged to the shift supervisor.`,
      });
    } else {
      setResult({
        ok: true,
        msg: "LOAD CLEARED",
        detail: `Crate ${barcode} — ${exp.name} matches the dispatch plan for ${order.order_code}.`,
      });
    }
    setBusy(false);
    router.refresh();
  }

  const sel =
    "w-full border rounded-lg px-3 py-2 text-[13px] bg-white";
  const selStyle = { borderColor: "var(--line)" };

  return (
    <div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="muted text-[11px] uppercase tracking-wider font-semibold">
            Dispatch order
          </label>
          <select
            className={sel}
            style={selStyle}
            value={orderId}
            onChange={(e) => {
              const o = orders.find((x) => x.id === e.target.value)!;
              setOrderId(o.id);
              setExpectedId(o.planned[0]?.product_id ?? "");
              setScannedId(o.planned[0]?.product_id ?? "");
              setResult(null);
            }}
          >
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.order_code} · dock {o.dock_no} · {o.distributor}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="muted text-[11px] uppercase tracking-wider font-semibold">
            Loader on the crate
          </label>
          <select
            className={sel}
            style={selStyle}
            value={loaderId}
            onChange={(e) => setLoaderId(e.target.value)}
          >
            {loaders.map((l) => (
              <option key={l.id} value={l.id}>
                {l.code} — {l.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="muted text-[11px] uppercase tracking-wider font-semibold">
            Planned SKU for this crate slot
          </label>
          <select
            className={sel}
            style={selStyle}
            value={expectedId}
            onChange={(e) => {
              setExpectedId(e.target.value);
              setResult(null);
            }}
          >
            {planned.map((pl) => {
              const p = byId(pl.product_id);
              return (
                <option key={pl.product_id} value={pl.product_id}>
                  {p?.pack_colour} — {p?.name} ({pl.crates_planned} crates)
                </option>
              );
            })}
          </select>
        </div>

        <div>
          <label className="muted text-[11px] uppercase tracking-wider font-semibold">
            SKU actually scanned at the gate
          </label>
          <select
            className={sel}
            style={selStyle}
            value={scannedId}
            onChange={(e) => {
              setScannedId(e.target.value);
              setResult(null);
            }}
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.pack_colour} — {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-4 flex-wrap">
        <button
          onClick={submit}
          disabled={busy || !order}
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
          {busy ? "Verifying…" : "Verify crate"}
        </button>
        <span className="muted text-[12px] flex items-center gap-2">
          <Dot hex={byId(expectedId)?.colour_hex} />
          planned
          <span className="mx-1">vs</span>
          <Dot hex={byId(scannedId)?.colour_hex} />
          scanned
        </span>
      </div>

      {result && (
        <div
          className="mt-4 rounded-xl p-4"
          style={{
            background: result.ok ? "#e6f9f1" : "#ffe8ee",
            border: `1px solid ${result.ok ? "#a9e8ce" : "#ffc4d3"}`,
          }}
        >
          <div
            className="mono font-bold"
            style={{ color: result.ok ? "#067a55" : "#b0093a", letterSpacing: ".08em" }}
          >
            {result.msg}
          </div>
          <div className="text-[13px] mt-1">{result.detail}</div>
        </div>
      )}
    </div>
  );
}
