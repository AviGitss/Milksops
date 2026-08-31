"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Pill, inr } from "@/components/ui";
import type { Alert } from "@/lib/types";

const MODULES = ["all", "fill", "dock", "carton", "quality"];
const SEV = ["all", "critical", "warning"];

export default function AlertTable({ alerts }: { alerts: Alert[] }) {
  const router = useRouter();
  const [mod, setMod] = useState("all");
  const [sev, setSev] = useState("all");
  const [status, setStatus] = useState("open");
  const [busy, setBusy] = useState<string | null>(null);

  const rows = alerts.filter(
    (a) =>
      (mod === "all" || a.module === mod) &&
      (sev === "all" || a.severity === sev) &&
      (status === "all" || a.status === status),
  );

  async function ack(id: string) {
    setBusy(id);
    await supabase
      .from("alerts")
      .update({
        status: "acknowledged",
        acknowledged_by: "plant-manager",
        acknowledged_at: new Date().toISOString(),
      })
      .eq("id", id);
    setBusy(null);
    router.refresh();
  }

  const sel = "border rounded-lg px-3 py-1.5 text-[12.5px] bg-white";
  const fs = { borderColor: "var(--line)" };

  return (
    <div>
      <div className="flex gap-2 flex-wrap mb-3">
        <select className={sel} style={fs} value={mod} onChange={(e) => setMod(e.target.value)}>
          {MODULES.map((m) => (
            <option key={m} value={m}>
              {m === "all" ? "All modules" : m}
            </option>
          ))}
        </select>
        <select className={sel} style={fs} value={sev} onChange={(e) => setSev(e.target.value)}>
          {SEV.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All severities" : s}
            </option>
          ))}
        </select>
        <select className={sel} style={fs} value={status} onChange={(e) => setStatus(e.target.value)}>
          {["open", "acknowledged", "closed", "all"].map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All statuses" : s}
            </option>
          ))}
        </select>
        <span className="muted text-[12px] self-center ml-1">
          {rows.length} shown ·{" "}
          {inr(rows.reduce((s, a) => s + Number(a.est_impact_inr || 0), 0))} exposure
        </span>
      </div>

      <div className="scroll" style={{ maxHeight: 620 }}>
        <table className="grid">
          <thead>
            <tr>
              <th>Raised</th>
              <th>Module</th>
              <th>Severity</th>
              <th style={{ whiteSpace: "normal" }}>Alert</th>
              <th>Exposure</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 200).map((a) => (
              <tr key={a.id}>
                <td className="mono muted">
                  {new Date(a.created_at).toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td>
                  <Pill tone="neutral">{a.module}</Pill>
                </td>
                <td>
                  <Pill tone={a.severity === "critical" ? "bad" : "warn"}>{a.severity}</Pill>
                </td>
                <td style={{ whiteSpace: "normal", maxWidth: 620 }}>
                  <div style={{ fontWeight: 600 }}>{a.title}</div>
                  <div className="muted text-[12px]">{a.detail}</div>
                </td>
                <td className="mono">{inr(a.est_impact_inr)}</td>
                <td>
                  <Pill
                    tone={
                      a.status === "open" ? "bad" : a.status === "acknowledged" ? "warn" : "ok"
                    }
                  >
                    {a.status}
                  </Pill>
                </td>
                <td>
                  {a.status === "open" && (
                    <button
                      onClick={() => ack(a.id)}
                      disabled={busy === a.id}
                      className="text-[12px]"
                      style={{
                        border: "1px solid var(--line)",
                        borderRadius: 8,
                        padding: "4px 10px",
                        background: "#fff",
                        color: "var(--brand-700)",
                        fontWeight: 600,
                      }}
                    >
                      {busy === a.id ? "…" : "Acknowledge"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
