import { supabase } from "@/lib/supabase";
import { Card, Kpi, Pill, num } from "@/components/ui";
import FormulaEditor, { type FormulaRow } from "@/components/FormulaEditor";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [fRes, mRes, nRes, cRes, lRes] = await Promise.all([
    supabase
      .from("fill_formulas")
      .select(
        "id,product_id,declared_volume_ml,density_g_per_ml,tare_pack_g,tolerance_pct,temp_ref_c,temp_coeff_per_c,formula_note,updated_at,products(sku_code,name,colour_hex,fill_target_g,fill_tol_g,category)",
      ),
    supabase
      .from("machines")
      .select("id,code,name,model,status,rated_speed_pph,lines(code)")
      .order("code"),
    supabase.from("nozzles").select("id,code,nozzle_no,status,cal_offset_g,last_calibrated_at,machine_id"),
    supabase.from("api_clients").select("*").order("created_at"),
    supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(25),
  ]);

  type Raw = Omit<FormulaRow, "sku_code" | "name" | "colour_hex" | "fill_target_g" | "fill_tol_g"> & {
    products: {
      sku_code: string;
      name: string;
      colour_hex: string | null;
      fill_target_g: number;
      fill_tol_g: number;
      category: string;
    } | null;
  };

  const rows: FormulaRow[] = ((fRes.data ?? []) as unknown as Raw[])
    .filter((r) => r.products)
    .map((r) => ({
      ...r,
      sku_code: r.products!.sku_code,
      name: r.products!.name,
      colour_hex: r.products!.colour_hex,
      fill_target_g: r.products!.fill_target_g,
      fill_tol_g: r.products!.fill_tol_g,
    }))
    .sort((a, b) => a.sku_code.localeCompare(b.sku_code));

  const machines = (mRes.data ?? []) as unknown as {
    id: string;
    code: string;
    name: string;
    model: string;
    status: string;
    rated_speed_pph: number;
    lines: { code: string } | null;
  }[];
  const nozzles = (nRes.data ?? []) as {
    id: string;
    code: string;
    nozzle_no: number;
    status: string;
    cal_offset_g: number;
    last_calibrated_at: string | null;
    machine_id: string;
  }[];
  const clients = (cRes.data ?? []) as {
    id: string;
    name: string;
    key_prefix: string;
    scope: string;
    active: boolean;
  }[];
  const leads = (lRes.data ?? []) as {
    id: string;
    created_at: string;
    full_name: string;
    work_email: string;
    company: string | null;
    job_title: string | null;
    phone: string | null;
    interest: string | null;
    status: string;
    visits: number;
  }[];

  const drifting = nozzles.filter((n) => n.status !== "ok");
  const stale = nozzles.filter(
    (n) => !n.last_calibrated_at || Date.now() - new Date(n.last_calibrated_at).getTime() > 30 * 864e5,
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[24px] m-0">Settings</h1>
        <p className="muted mt-1 mb-0 max-w-[900px]">
          The plant&apos;s configuration lives here: how a pack&apos;s declared volume
          becomes a target weight on the checkweigher, the machine and nozzle
          register the SPC module attributes deviation to, and the device keys the
          RFID and analyser integrations authenticate with.
        </p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Kpi label="SKU formulas configured" value={rows.length} tone="ok" note="Weight ↔ volume" />
        <Kpi label="Filling machines" value={machines.length} note="2 nozzles each" />
        <Kpi
          label="Nozzles"
          value={nozzles.length}
          tone={drifting.length ? "warn" : "ok"}
          note={`${drifting.length} flagged drifting`}
        />
        <Kpi
          label="Calibration overdue"
          value={stale.length}
          tone={stale.length ? "bad" : "ok"}
          note="Not calibrated in 30 days"
        />
      </div>

      <Card
        title="Weight ↔ volume formula per product"
        subtitle="Editable. Saving recomputes the target and tolerance used everywhere in Fill Control."
      >
        <FormulaEditor rows={rows} />
      </Card>

      <Card
        title="Filling machine register"
        subtitle={`${machines.length} machines × 2 nozzles = ${nozzles.length} filling points. Every checkweigher reading is attributed to one of them.`}
      >
        <div className="scroll" style={{ maxHeight: 460 }}>
          <table className="grid">
            <thead>
              <tr>
                <th>Machine</th>
                <th>Name</th>
                <th>Line</th>
                <th>Model</th>
                <th>Rated</th>
                <th>Status</th>
                <th>Nozzle 1</th>
                <th>Nozzle 2</th>
                <th>Last calibrated</th>
              </tr>
            </thead>
            <tbody>
              {machines.map((m) => {
                const ns = nozzles.filter((n) => n.machine_id === m.id).sort((a, b) => a.nozzle_no - b.nozzle_no);
                const last = ns
                  .map((n) => n.last_calibrated_at)
                  .filter(Boolean)
                  .sort()
                  .slice(-1)[0];
                return (
                  <tr key={m.id}>
                    <td className="mono">{m.code}</td>
                    <td>{m.name}</td>
                    <td>{m.lines?.code}</td>
                    <td className="muted">{m.model}</td>
                    <td className="mono">{m.rated_speed_pph?.toLocaleString("en-IN")} pph</td>
                    <td>
                      <Pill tone={m.status === "running" ? "ok" : "warn"}>{m.status}</Pill>
                    </td>
                    {[0, 1].map((i) => (
                      <td key={i}>
                        {ns[i] ? (
                          <Pill tone={ns[i].status === "ok" ? "ok" : "bad"}>
                            {ns[i].status} {num(ns[i].cal_offset_g, 2)}g
                          </Pill>
                        ) : (
                          "—"
                        )}
                      </td>
                    ))}
                    <td className="mono muted">
                      {last ? new Date(last).toLocaleDateString("en-IN") : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Device API clients"
          subtitle="Each integration authenticates with its own key. Keys are never displayed after issue."
        >
          <table className="grid">
            <thead>
              <tr>
                <th>Client</th>
                <th>Key prefix</th>
                <th>Scope</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td className="mono">{c.key_prefix}_••••••••</td>
                  <td>
                    <Pill tone="neutral">{c.scope}</Pill>
                  </td>
                  <td>
                    <Pill tone={c.active ? "ok" : "warn"}>{c.active ? "active" : "revoked"}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted text-[12px] mt-3 mb-0">
            Demo build accepts the shared key{" "}
            <span className="mono">onk_demo_key_2026</span> on every ingest route.
            Before the pilot, issue one key per device and check it against this
            table inside <span className="mono">authorise()</span>.
          </p>
        </Card>

        <Card
          title="Captured leads"
          subtitle="Everyone who has signed in through the front door"
        >
          <div className="scroll" style={{ maxHeight: 320 }}>
            <table className="grid">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Company</th>
                  <th>Interest</th>
                  <th>Visits</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id}>
                    <td className="mono muted">
                      {new Date(l.created_at).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </td>
                    <td>{l.full_name}</td>
                    <td className="mono">{l.work_email}</td>
                    <td>{l.company}</td>
                    <td className="muted">{l.interest}</td>
                    <td className="mono">{l.visits}</td>
                  </tr>
                ))}
                {leads.length === 0 && (
                  <tr>
                    <td colSpan={6} className="muted">
                      No leads captured yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
