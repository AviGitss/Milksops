"use client";

import { useState } from "react";
import Image from "next/image";

const INTERESTS = [
  "Fill volume control (SPC)",
  "Dock crate verification",
  "Carton RFID reconciliation",
  "Fat / SNF monitoring",
  "SCADA data integration",
  "Whole plant assurance",
];

export default function LoginPage() {
  const [f, setF] = useState({
    fullName: "",
    workEmail: "",
    company: "",
    jobTitle: "",
    phone: "",
    plantLocation: "",
    interest: INTERESTS[0],
    message: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      const j = await r.json();
      if (!j.ok) {
        setErr(j.error || "Could not sign you in");
        setBusy(false);
        return;
      }
      document.cookie = `dairyops_user=${encodeURIComponent(f.fullName)}; path=/; max-age=86400; samesite=lax`;
      const next = new URLSearchParams(window.location.search).get("next") || "/";
      window.location.href = next;
    } catch {
      setErr("Network error — please try again");
      setBusy(false);
    }
  }

  const input = "w-full border rounded-lg px-3 py-2 text-[13px] bg-white mt-1";
  const st = { borderColor: "var(--line)" };
  const lbl = "muted text-[11px] uppercase tracking-wider font-semibold";

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Brand / value side */}
      <div
        className="px-8 py-10 lg:px-14 lg:py-16 flex flex-col justify-between"
        style={{
          background: "linear-gradient(150deg,#2d1b69 0%,#4a2fa0 55%,#7b5fc4 100%)",
          color: "#fff",
        }}
      >
        <div>
          <div
            className="inline-flex items-center rounded-xl px-3 py-2"
            style={{ background: "#fff" }}
          >
            <Image
              src="/opennetrikkan.png"
              alt="Open Netrikkan"
              width={168}
              height={42}
              priority
              style={{ height: 28, width: "auto" }}
            />
          </div>
          <h1
            className="mt-10 mb-0"
            style={{ fontSize: 38, lineHeight: 1.15, letterSpacing: "-0.02em" }}
          >
            Nandini <span style={{ color: "#f0c040" }}>DairyOps</span>
          </h1>
          <p className="mt-4 mb-0" style={{ color: "#e2d9f8", fontSize: 15, maxWidth: 460 }}>
            Plant assurance that sits outside the closed SCADA panel. Fill volume
            under statistical control, crate substitution stopped at the gate,
            a lakh cartons a day reconciled by RFID, and fat/SNF answerable
            back to the society that supplied the milk.
          </p>

          <div className="mt-8 grid gap-3" style={{ maxWidth: 460 }}>
            {[
              ["70 machines · 140 nozzles", "Deviation traced to the nozzle, not the batch"],
              ["Passive UHF RFID", "Issue → pack → damage → dispatch, balanced daily"],
              ["Fat / SNF at three points", "Silo, pasteuriser and pack against the legal spec"],
              ["No PLC write-back", "Historian import only — no vendor negotiation"],
            ].map(([t, d]) => (
              <div key={t} className="flex gap-3 items-start">
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 6,
                    background: "#f0c040",
                    marginTop: 7,
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{t}</div>
                  <div style={{ color: "#c8b5f5", fontSize: 12.5 }}>{d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-10 mb-0" style={{ color: "#c8b5f5", fontSize: 11.5 }}>
          Open Netrikkan Private Limited · Bengaluru · AI-native simulation and
          assurance for manufacturing
        </p>
      </div>

      {/* Lead capture */}
      <div className="px-8 py-10 lg:px-14 lg:py-16 flex items-center">
        <form onSubmit={submit} className="w-full" style={{ maxWidth: 520 }}>
          <h2 className="m-0" style={{ fontSize: 24 }}>
            Sign in to the demo plant
          </h2>
          <p className="muted mt-2 mb-6 text-[13px]">
            Tell us who you are and we will open the live Nandini plant instance.
            Your details go to the Open Netrikkan team — nothing else.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={lbl}>Full name *</label>
              <input className={input} style={st} value={f.fullName} onChange={set("fullName")} required placeholder="Ramesh Gowda" />
            </div>
            <div className="sm:col-span-2">
              <label className={lbl}>Work email *</label>
              <input className={input} style={st} type="email" value={f.workEmail} onChange={set("workEmail")} required placeholder="you@dairy.coop" />
            </div>
            <div>
              <label className={lbl}>Company</label>
              <input className={input} style={st} value={f.company} onChange={set("company")} placeholder="KMF Nandini" />
            </div>
            <div>
              <label className={lbl}>Role</label>
              <input className={input} style={st} value={f.jobTitle} onChange={set("jobTitle")} placeholder="Plant Manager" />
            </div>
            <div>
              <label className={lbl}>Phone</label>
              <input className={input} style={st} value={f.phone} onChange={set("phone")} placeholder="+91 98450 00000" />
            </div>
            <div>
              <label className={lbl}>Plant / location</label>
              <input className={input} style={st} value={f.plantLocation} onChange={set("plantLocation")} placeholder="Bengaluru" />
            </div>
            <div className="sm:col-span-2">
              <label className={lbl}>What brings you here</label>
              <select className={input} style={st} value={f.interest} onChange={set("interest")}>
                {INTERESTS.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={lbl}>Anything specific to look at?</label>
              <textarea
                className={input}
                style={{ ...st, minHeight: 72 }}
                value={f.message}
                onChange={set("message")}
                placeholder="We reject roughly two batches a week on weight checks…"
              />
            </div>
          </div>

          {err && (
            <div
              className="mt-4 rounded-lg px-3 py-2 text-[13px]"
              style={{ background: "#ffe8ee", color: "#b0093a" }}
            >
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-5 w-full"
            style={{
              background: "var(--brand-700)",
              color: "#fff",
              padding: "12px 20px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? "Opening the plant…" : "Enter the plant"}
          </button>

          <p className="muted text-[11.5px] mt-4 mb-0">
            Demo access. The instance carries synthetic plant data — no live KMF
            production records.
          </p>
        </form>
      </div>
    </div>
  );
}
