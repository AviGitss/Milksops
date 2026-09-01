"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pill } from "@/components/ui";

type Ev = {
  id: number;
  epc: string;
  reader_code: string;
  antenna: number | null;
  rssi: number | null;
  event_type: string;
  ts: string;
  reason_code: string | null;
};

const toneFor = (t: string) =>
  t === "damaged" ? "bad" : t === "dispatch" ? "ok" : t === "issue" ? "neutral" : "warn";

export default function RfidPanel() {
  const router = useRouter();
  const [events, setEvents] = useState<Ev[]>([]);
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [count, setCount] = useState(40);

  async function load() {
    const r = await fetch("/api/rfid/events?limit=40", { cache: "no-store" });
    const j = await r.json();
    if (j.ok) setEvents(j.events);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!live) return;
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [live]);

  async function simulate() {
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/rfid/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count }),
    });
    const j = await r.json();
    setMsg(
      j.ok
        ? `Test stub fed ${j.events} reads for ${j.tags} cartons through the portals.`
        : j.error || "Simulation failed",
    );
    setBusy(false);
    await load();
    router.refresh();
  }

  const btn = {
    background: "var(--brand-700)",
    color: "#fff",
    padding: "8px 16px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
  };

  return (
    <div>
      <div className="flex gap-3 items-center flex-wrap mb-3">
        <input
          type="number"
          min={1}
          max={500}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="border rounded-lg px-3 py-2 text-[13px] bg-white mono"
          style={{ borderColor: "var(--line)", width: 90 }}
        />
        <button onClick={simulate} disabled={busy} style={{ ...btn, opacity: busy ? 0.6 : 1 }}>
          {busy ? "Feeding…" : "Feed test reads"}
        </button>
        <button
          onClick={() => setLive(!live)}
          className="text-[13px]"
          style={{
            border: "1px solid var(--line)",
            background: live ? "#e6f9f1" : "#fff",
            color: live ? "#067a55" : "var(--brand-700)",
            borderRadius: 10,
            padding: "8px 16px",
            fontWeight: 600,
          }}
        >
          {live ? "● Live — polling every 4s" : "Start live feed"}
        </button>
        <span className="muted text-[12px]">
          Stub stands in for the reader middleware until the portals are commissioned.
        </span>
      </div>

      {msg && <div className="text-[12.5px] mb-3">{msg}</div>}

      <div className="scroll" style={{ maxHeight: 420 }}>
        <table className="grid">
          <thead>
            <tr>
              <th>Time</th>
              <th>EPC</th>
              <th>Reader</th>
              <th>Ant</th>
              <th>RSSI</th>
              <th>Event</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td className="mono muted">
                  {new Date(e.ts).toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </td>
                <td className="mono">{e.epc}</td>
                <td className="mono">{e.reader_code}</td>
                <td className="mono">{e.antenna ?? "—"}</td>
                <td className="mono">{e.rssi != null ? `${e.rssi} dBm` : "—"}</td>
                <td>
                  <Pill tone={toneFor(e.event_type)}>{e.event_type}</Pill>
                </td>
                <td className="muted">{e.reason_code ?? "—"}</td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  No reads yet — press “Feed test reads”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
