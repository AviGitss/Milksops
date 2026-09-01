import { supabase } from "@/lib/supabase";
import { Card, Kpi, Pill, Dot, inr } from "@/components/ui";
import { SimpleBar, STATUS } from "@/components/charts";
import ScanVerifier from "@/components/ScanVerifier";
import TruckAssign, { type OrderRow } from "@/components/TruckAssign";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

type Scan = {
  id: string;
  crate_barcode: string;
  scanned_at: string;
  verdict: string;
  value_delta: number;
  dock_no: string | null;
  note: string | null;
  expected: { name: string; pack_colour: string | null; colour_hex: string | null } | null;
  scanned: { name: string; pack_colour: string | null; colour_hex: string | null } | null;
  loader: { name: string; code: string } | null;
  order: { order_code: string; distributor: string | null } | null;
};

export default async function DockPage() {
  const since = new Date(Date.now() - 14 * 864e5).toISOString();

  const [scanRes, prodRes, loaderRes, orderRes, lineRes] = await Promise.all([
    supabase
      .from("dock_scans")
      .select(
        "id,crate_barcode,scanned_at,verdict,value_delta,dock_no,note," +
          "expected:expected_product_id(name,pack_colour,colour_hex)," +
          "scanned:scanned_product_id(name,pack_colour,colour_hex)," +
          "loader:loader_id(name,code)," +
          "order:order_id(order_code,distributor)",
      )
      .gte("scanned_at", since)
      .order("scanned_at", { ascending: false })
      .limit(1200),
    supabase.from("products").select("*").eq("active", true).order("sku_code"),
    supabase.from("loaders").select("id,name,code").eq("active", true).order("code"),
    supabase
      .from("dispatch_orders")
      .select(
        "id,order_code,dock_no,distributor,route_code,dispatch_date,status,truck_no,transporter,driver_name,driver_phone,packing_person,gate_pass_no",
      )
      .order("dispatch_date", { ascending: false })
      .limit(24),
    supabase.from("dispatch_lines").select("order_id,product_id,crates_planned"),
  ]);

  const scans = (scanRes.data ?? []) as unknown as Scan[];
  const products = (prodRes.data ?? []) as Product[];
  const loaders = (loaderRes.data ?? []) as { id: string; name: string; code: string }[];
  const lines = (lineRes.data ?? []) as {
    order_id: string;
    product_id: string;
    crates_planned: number;
  }[];

  const orderRows = (orderRes.data ?? []) as unknown as OrderRow[];
  const orders = orderRows.map((o) => ({
    ...o,
    planned: lines.filter((l) => l.order_id === o.id),
  }));

  const mismatches = scans.filter((s) => s.verdict === "mismatch");
  const leakage = mismatches.reduce((s, m) => s + Math.abs(Number(m.value_delta)), 0);
  const accuracy = scans.length
    ? ((scans.length - mismatches.length) / scans.length) * 100
    : 100;

  const byLoader = Object.values(
    mismatches.reduce<Record<string, { loader: string; count: number }>>((acc, m) => {
      const k = m.loader?.code ?? "—";
      acc[k] ??= { loader: k, count: 0 };
      acc[k].count += 1;
      return acc;
    }, {}),
  ).sort((a, b) => b.count - a.count);

  const byDock = Object.values(
    mismatches.reduce<Record<string, { dock: string; count: number }>>((acc, m) => {
      const k = m.dock_no ?? "—";
      acc[k] ??= { dock: k, count: 0 };
      acc[k].count += 1;
      return acc;
    }, {}),
  ).sort((a, b) => a.dock.localeCompare(b.dock));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[24px] m-0">Dock Crate Verification</h1>
        <p className="muted mt-1 mb-0 max-w-[860px]">
          Substitution at the dock works because nothing compares what leaves the
          gate against what was planned. Here every crate barcode is checked
          against the dispatch order at the moment of loading — a mismatch blocks
          the crate, names the loader, and prices the variance.
        </p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Scan accuracy (14 days)"
          value={accuracy.toFixed(2)}
          unit="%"
          tone={accuracy >= 99.5 ? "ok" : "warn"}
          note={`${scans.length.toLocaleString("en-IN")} crates verified`}
        />
        <Kpi
          label="Substitutions caught"
          value={mismatches.length}
          tone={mismatches.length ? "bad" : "ok"}
          note="High-value pack replaced with low-value"
        />
        <Kpi
          label="Value protected"
          value={inr(leakage)}
          tone="ok"
          note="MRP variance × 24 pouches per crate"
        />
        <Kpi
          label="Loaders implicated"
          value={byLoader.length}
          tone={byLoader.length > 3 ? "bad" : "warn"}
          note={byLoader[0] ? `Highest: ${byLoader[0].loader} (${byLoader[0].count})` : "—"}
        />
      </div>

      <Card
        title="Truck assignment against the order sheet"
        subtitle="Vehicle, transporter, driver and packing person, bound to the order before loading starts"
      >
        <TruckAssign orders={orderRows} />
      </Card>

      <Card
        title="Gate scanner"
        subtitle="Live check — this is what the handheld at the dock door does. Every verification is written to the crate ledger."
      >
        <ScanVerifier orders={orders} products={products} loaders={loaders} />
      </Card>

      <Card
        title="Dispatch register"
        subtitle="Which vehicle carried which order, who packed it, and under which gate pass"
      >
        <div className="scroll" style={{ maxHeight: 360 }}>
          <table className="grid">
            <thead>
              <tr>
                <th>Order</th>
                <th>Date</th>
                <th>Route</th>
                <th>Dock</th>
                <th>Distributor</th>
                <th>Truck</th>
                <th>Transporter</th>
                <th>Driver</th>
                <th>Packed by</th>
                <th>Gate pass</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orderRows.map((o) => (
                <tr key={o.id}>
                  <td className="mono">{o.order_code}</td>
                  <td className="mono muted">
                    {new Date(o.dispatch_date).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </td>
                  <td>{o.route_code}</td>
                  <td>{o.dock_no}</td>
                  <td>{o.distributor}</td>
                  <td className="mono" style={{ fontWeight: 600 }}>
                    {o.truck_no ?? "—"}
                  </td>
                  <td className="muted">{o.transporter ?? "—"}</td>
                  <td>{o.driver_name ?? "—"}</td>
                  <td>{o.packing_person ?? "—"}</td>
                  <td className="mono muted">{o.gate_pass_no ?? "—"}</td>
                  <td>
                    <Pill tone={o.status === "dispatched" ? "ok" : "warn"}>{o.status}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Substitutions by loader"
          subtitle="Attribution is what makes the control stick"
        >
          <SimpleBar
            data={byLoader}
            xKey="loader"
            yKey="count"
            label="Substitutions"
            color={STATUS.critical}
          />
        </Card>
        <Card title="Substitutions by dock" subtitle="Where the gap in supervision sits">
          <SimpleBar
            data={byDock}
            xKey="dock"
            yKey="count"
            label="Substitutions"
            color={STATUS.warning}
          />
        </Card>
      </div>

      <Card
        title="Mismatch ledger"
        subtitle="Each row is a blocked crate with the exact swap recorded"
      >
        <div className="scroll" style={{ maxHeight: 440 }}>
          <table className="grid">
            <thead>
              <tr>
                <th>Scanned at</th>
                <th>Crate</th>
                <th>Order</th>
                <th>Dock</th>
                <th>Planned</th>
                <th>Actually loaded</th>
                <th>Loader</th>
                <th>Value variance</th>
              </tr>
            </thead>
            <tbody>
              {mismatches.slice(0, 60).map((m) => (
                <tr key={m.id}>
                  <td className="mono muted">
                    {new Date(m.scanned_at).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="mono">{m.crate_barcode}</td>
                  <td className="mono">{m.order?.order_code}</td>
                  <td>{m.dock_no}</td>
                  <td>
                    <Dot hex={m.expected?.colour_hex} />
                    {m.expected?.name}
                  </td>
                  <td>
                    <Dot hex={m.scanned?.colour_hex} />
                    {m.scanned?.name}
                  </td>
                  <td>{m.loader?.name}</td>
                  <td className="mono" style={{ color: "var(--bad)" }}>
                    {inr(-Math.abs(Number(m.value_delta)))}
                  </td>
                </tr>
              ))}
              {mismatches.length === 0 && (
                <tr>
                  <td colSpan={8} className="muted">
                    No substitutions in the period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Recent scan feed" subtitle="Last 40 crate verifications, cleared and blocked">
        <div className="scroll" style={{ maxHeight: 340 }}>
          <table className="grid">
            <thead>
              <tr>
                <th>Time</th>
                <th>Crate</th>
                <th>SKU</th>
                <th>Loader</th>
                <th>Verdict</th>
              </tr>
            </thead>
            <tbody>
              {scans.slice(0, 40).map((s) => (
                <tr key={s.id}>
                  <td className="mono muted">
                    {new Date(s.scanned_at).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="mono">{s.crate_barcode}</td>
                  <td>
                    <Dot hex={s.scanned?.colour_hex} />
                    {s.scanned?.name}
                  </td>
                  <td>{s.loader?.name}</td>
                  <td>
                    <Pill tone={s.verdict === "ok" ? "ok" : s.verdict === "mismatch" ? "bad" : "warn"}>
                      {s.verdict === "ok" ? "cleared" : s.verdict === "mismatch" ? "blocked" : s.verdict}
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
