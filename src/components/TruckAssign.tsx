"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export type OrderRow = {
  id: string;
  order_code: string;
  dock_no: string | null;
  distributor: string | null;
  route_code: string | null;
  dispatch_date: string;
  status: string;
  truck_no: string | null;
  transporter: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  packing_person: string | null;
  gate_pass_no: string | null;
};

const TRANSPORTERS = [
  "Sri Sai Logistics",
  "KMF Cold Chain",
  "Deccan Carriers",
  "Malnad Transports",
];
const PACKERS = ["Pack-Lakshmi", "Pack-Ravi", "Pack-Gowri", "Pack-Naveen"];

export default function TruckAssign({ orders }: { orders: OrderRow[] }) {
  const router = useRouter();
  const [id, setId] = useState(orders[0]?.id ?? "");
  const order = orders.find((o) => o.id === id);
  const [f, setF] = useState({
    truck_no: order?.truck_no ?? "",
    transporter: order?.transporter ?? TRANSPORTERS[0],
    driver_name: order?.driver_name ?? "",
    driver_phone: order?.driver_phone ?? "",
    packing_person: order?.packing_person ?? PACKERS[0],
    gate_pass_no: order?.gate_pass_no ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function pick(nid: string) {
    const o = orders.find((x) => x.id === nid);
    setId(nid);
    setMsg(null);
    setF({
      truck_no: o?.truck_no ?? "",
      transporter: o?.transporter ?? TRANSPORTERS[0],
      driver_name: o?.driver_name ?? "",
      driver_phone: o?.driver_phone ?? "",
      packing_person: o?.packing_person ?? PACKERS[0],
      gate_pass_no: o?.gate_pass_no ?? "",
    });
  }

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!order) return;
    const truck = f.truck_no.trim().toUpperCase();
    if (!/^[A-Z]{2}[- ]?\d{1,2}[- ]?[A-Z]{1,3}[- ]?\d{1,4}$/.test(truck)) {
      setMsg("Truck number does not look like an Indian registration (e.g. KA-19-AB-4821).");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("dispatch_orders")
      .update({ ...f, truck_no: truck })
      .eq("id", order.id);
    setBusy(false);
    setMsg(
      error
        ? `Could not save: ${error.message}`
        : `${order.order_code} assigned to ${truck} — ${f.transporter}, driver ${f.driver_name || "—"}, packed by ${f.packing_person}. Every crate scanned at the gate now attaches to this vehicle.`,
    );
    if (!error) router.refresh();
  }

  const inp = "w-full border rounded-lg px-3 py-2 text-[13px] bg-white mt-1";
  const st = { borderColor: "var(--line)" };
  const lbl = "muted text-[11px] uppercase tracking-wider font-semibold";

  return (
    <form onSubmit={save}>
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <label className={lbl}>Order sheet</label>
          <select className={inp} style={st} value={id} onChange={(e) => pick(e.target.value)}>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.order_code} · {o.route_code} · dock {o.dock_no} · {o.distributor}
                {o.truck_no ? ` — ${o.truck_no}` : " — unassigned"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={lbl}>Truck number *</label>
          <input
            className={inp}
            style={st}
            value={f.truck_no}
            onChange={set("truck_no")}
            placeholder="KA-19-AB-4821"
            required
          />
        </div>
        <div>
          <label className={lbl}>Transporter</label>
          <select className={inp} style={st} value={f.transporter} onChange={set("transporter")}>
            {TRANSPORTERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={lbl}>Driver</label>
          <input className={inp} style={st} value={f.driver_name} onChange={set("driver_name")} placeholder="Mahesh B" />
        </div>
        <div>
          <label className={lbl}>Driver phone</label>
          <input className={inp} style={st} value={f.driver_phone} onChange={set("driver_phone")} placeholder="98450 12345" />
        </div>
        <div>
          <label className={lbl}>Packing person</label>
          <select className={inp} style={st} value={f.packing_person} onChange={set("packing_person")}>
            {PACKERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={lbl}>Gate pass no.</label>
          <input className={inp} style={st} value={f.gate_pass_no} onChange={set("gate_pass_no")} placeholder="GP-260831-014" />
        </div>
      </div>

      <button
        type="submit"
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
        {busy ? "Saving…" : "Assign truck to order"}
      </button>

      {msg && <div className="mt-3 text-[13px]">{msg}</div>}

      <p className="muted text-[12px] mt-2 mb-0">
        The truck is bound to the order sheet, not to the packing person — so a
        substitution found later resolves to a vehicle and a gate pass as well as
        to whoever loaded the crate.
      </p>
    </form>
  );
}
