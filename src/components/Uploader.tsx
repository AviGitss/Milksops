"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type SourceDef = {
  key: string;
  title: string;
  blurb: string;
  origin: string;
  columns: { name: string; required: boolean; note: string }[];
  sample: string;
};

export const SOURCES: SourceDef[] = [
  {
    key: "weights",
    title: "Fill weight measurements",
    blurb:
      "Checkweigher export, or the random-sample sheet the QA operator fills on the floor. Machine and nozzle are what make a reading actionable — without them a low weight only condemns the batch.",
    origin: "Checkweigher gateway · random sample scale · shift log sheet",
    columns: [
      { name: "batch_code", required: true, note: "must match an open or completed batch" },
      { name: "net_weight_g", required: true, note: "gross weight from the scale, grams" },
      { name: "machine_code", required: false, note: "FM-001 … FM-070" },
      { name: "nozzle_no", required: false, note: "1 or 2" },
      { name: "sampled_at", required: false, note: "ISO timestamp; defaults to now" },
      { name: "source", required: false, note: "checkweigher | random-sample | manual" },
    ],
    sample:
      "batch_code,net_weight_g,machine_code,nozzle_no,sampled_at,source\nB260831-0001,520.4,FM-012,1,2026-08-31T06:12:00+05:30,checkweigher\nB260831-0001,517.9,FM-012,2,2026-08-31T06:12:30+05:30,checkweigher\nB260831-0001,521.1,FM-013,1,2026-08-31T06:13:00+05:30,random-sample\n",
  },
  {
    key: "quality",
    title: "Fat / SNF test results",
    blurb:
      "The QA lab book, or a milko-analyser export. Rows are graded against each SKU's declared spec on ingest and raise an alert when they fall short.",
    origin: "Milko-analyser · Gerber bench · QA lab register",
    columns: [
      { name: "sku", required: true, note: "or batch_code — one must resolve a product" },
      { name: "fat_pct", required: true, note: "measured fat, %" },
      { name: "snf_pct", required: true, note: "measured SNF, %" },
      { name: "sample_point", required: false, note: "raw | silo | standardised | pasteuriser | packed" },
      { name: "batch_code", required: false, note: "links the result to a batch" },
      { name: "tested_at", required: false, note: "ISO timestamp" },
      { name: "tested_by", required: false, note: "analyst" },
    ],
    sample:
      "sku,batch_code,sample_point,fat_pct,snf_pct,temperature_c,tested_at,tested_by\nNTM500,B260831-0001,packed,3.05,8.62,5.1,2026-08-31T07:40:00+05:30,QA-Suma\nNFC500,B260831-0002,pasteuriser,6.08,9.11,4.6,2026-08-31T08:10:00+05:30,QA-Nagesh\n",
  },
  {
    key: "cartons",
    title: "Carton movements",
    blurb:
      "Store issue slips and line consumption sheets, for cartons not yet tagged. Once RFID covers a line, the events feed replaces this file.",
    origin: "Carton store register · line scrap log",
    columns: [
      { name: "txn_type", required: true, note: "receipt | issue | used | damaged | returned" },
      { name: "qty", required: true, note: "carton count" },
      { name: "carton_type", required: false, note: "CT-500 | CT-1000 | CT-CUP | CT-BTL" },
      { name: "line_code", required: false, note: "L1 … L5" },
      { name: "txn_date", required: false, note: "YYYY-MM-DD" },
      { name: "shift", required: false, note: "A | B | C" },
      { name: "reason_code", required: false, note: "required in practice for damaged" },
    ],
    sample:
      "txn_date,shift,carton_type,line_code,txn_type,qty,reason_code\n2026-08-31,A,CT-500,L1,issue,6200,\n2026-08-31,A,CT-500,L1,used,5910,\n2026-08-31,A,CT-500,L1,damaged,180,erector-jam\n",
  },
  {
    key: "rfid",
    title: "RFID reader dump",
    blurb:
      "Offline reader export — for backfilling a portal that lost its network link. The live path is the POST API; this is the recovery path.",
    origin: "Reader SD card export · middleware replay file",
    columns: [
      { name: "epc", required: true, note: "16–32 hex characters" },
      { name: "reader_code", required: true, note: "RDR-DK-D1 etc." },
      { name: "event_type", required: false, note: "issue | pack | damaged | dispatch | return | read" },
      { name: "ts", required: false, note: "ISO timestamp" },
      { name: "antenna", required: false, note: "1–4" },
      { name: "rssi", required: false, note: "dBm, negative" },
    ],
    sample:
      "epc,reader_code,antenna,rssi,event_type,ts\nE28011A1B2C3D4E5F60718,RDR-DK-D1,2,-52.4,dispatch,2026-08-31T10:02:11+05:30\nE28011A1B2C3D4E5F60719,RDR-SCR-01,1,-61.0,damaged,2026-08-31T10:04:02+05:30\n",
  },
  {
    key: "tankers",
    title: "Raw milk intake",
    blurb:
      "Tanker bay register — the upstream cause of most composition drift. Ties a society code to what arrived.",
    origin: "Tanker bay weighbridge · intake lab",
    columns: [
      { name: "tanker_no", required: true, note: "registration" },
      { name: "qty_litres", required: true, note: "received volume" },
      { name: "society_code", required: false, note: "supplying society" },
      { name: "fat_pct", required: false, note: "intake fat" },
      { name: "snf_pct", required: false, note: "intake SNF" },
      { name: "temperature_c", required: false, note: "at receipt" },
      { name: "accepted", required: false, note: "true | false" },
    ],
    sample:
      "tanker_no,society_code,received_at,qty_litres,fat_pct,snf_pct,temperature_c,accepted\nKA-19-C-4821,SOC-014,2026-08-31T04:20:00+05:30,11800,4.12,8.71,4.8,true\nKA-05-C-2210,SOC-031,2026-08-31T05:05:00+05:30,9400,3.88,8.54,7.9,false\n",
  },
  {
    key: "dispatch",
    title: "Dispatch / truck sheet",
    blurb:
      "Assign the truck, transporter, driver and packing person against each order sheet — the record a dock mismatch is later attributed to.",
    origin: "Dispatch office order sheet",
    columns: [
      { name: "order_code", required: true, note: "existing dispatch order" },
      { name: "truck_no", required: false, note: "vehicle registration" },
      { name: "transporter", required: false, note: "fleet operator" },
      { name: "driver_name", required: false, note: "" },
      { name: "driver_phone", required: false, note: "" },
      { name: "packing_person", required: false, note: "who packed the order" },
      { name: "gate_pass_no", required: false, note: "" },
    ],
    sample:
      "order_code,truck_no,transporter,driver_name,driver_phone,packing_person,gate_pass_no\nDO260831-001,KA-19-AB-4821,Sri Sai Logistics,Mahesh B,9845012345,Pack-Lakshmi,GP-260831-014\n",
  },
];

export default function Uploader({ uploadedBy }: { uploadedBy: string }) {
  const router = useRouter();
  const [active, setActive] = useState(SOURCES[0].key);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<null | {
    ok: boolean;
    text: string;
    errors?: { row: number; reason: string }[];
  }>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const def = SOURCES.find((s) => s.key === active)!;

  async function send(file: File) {
    setBusy(true);
    setRes(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("source", active);
    fd.append("uploadedBy", uploadedBy || "web-upload");
    try {
      const r = await fetch("/api/uploads", { method: "POST", body: fd });
      const j = await r.json();
      if (!j.ok) {
        setRes({ ok: false, text: j.error || "Upload failed", errors: j.errors });
      } else {
        setRes({
          ok: j.rejected === 0,
          text: `${file.name}: ${j.accepted} of ${j.rowsTotal} rows accepted${
            j.rejected ? `, ${j.rejected} rejected` : ""
          }.`,
          errors: j.errors,
        });
        router.refresh();
      }
    } catch {
      setRes({ ok: false, text: "Network error while uploading" });
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function downloadTemplate() {
    const blob = new Blob([def.sample], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${def.key}-template.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div>
      <div className="flex gap-2 flex-wrap mb-4">
        {SOURCES.map((s) => (
          <button
            key={s.key}
            onClick={() => {
              setActive(s.key);
              setRes(null);
            }}
            className="text-[12.5px]"
            style={{
              padding: "6px 13px",
              borderRadius: 999,
              fontWeight: active === s.key ? 600 : 500,
              background: active === s.key ? "var(--brand-700)" : "#fff",
              color: active === s.key ? "#fff" : "var(--ink-900)",
              border: "1px solid var(--line)",
            }}
          >
            {s.title}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-[13px] mt-0">{def.blurb}</p>
          <p className="muted text-[12px]">
            <strong>Comes from:</strong> {def.origin}
          </p>

          <label
            className="block rounded-xl text-center cursor-pointer"
            style={{
              border: "2px dashed var(--brand-300)",
              background: "#faf8ff",
              padding: "28px 18px",
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) send(f);
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) send(f);
              }}
            />
            <div style={{ fontWeight: 600, fontSize: 14, color: "var(--brand-700)" }}>
              {busy ? "Uploading…" : `Drop the ${def.title.toLowerCase()} file here`}
            </div>
            <div className="muted text-[12px] mt-1">
              or click to browse · CSV, up to 8 MB
            </div>
          </label>

          <button
            onClick={downloadTemplate}
            className="mt-3 text-[12.5px]"
            style={{
              border: "1px solid var(--line)",
              background: "#fff",
              borderRadius: 8,
              padding: "6px 14px",
              color: "var(--brand-700)",
              fontWeight: 600,
            }}
          >
            Download {def.key} template
          </button>

          {res && (
            <div
              className="mt-4 rounded-xl p-3 text-[12.5px]"
              style={{
                background: res.ok ? "#e6f9f1" : "#fff4e0",
                border: `1px solid ${res.ok ? "#a9e8ce" : "#f3d9a4"}`,
              }}
            >
              <div style={{ fontWeight: 600 }}>{res.text}</div>
              {res.errors && res.errors.length > 0 && (
                <ul className="mt-2 mb-0 muted" style={{ paddingLeft: 18 }}>
                  {res.errors.slice(0, 8).map((e, i) => (
                    <li key={i}>
                      Row {e.row}: {e.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div>
          <div className="muted text-[11px] uppercase tracking-wider font-semibold mb-2">
            Expected columns
          </div>
          <table className="grid">
            <thead>
              <tr>
                <th>Column</th>
                <th>Required</th>
                <th style={{ whiteSpace: "normal" }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {def.columns.map((c) => (
                <tr key={c.name}>
                  <td className="mono">{c.name}</td>
                  <td>
                    <span className={`pill pill-${c.required ? "bad" : "neutral"}`}>
                      {c.required ? "required" : "optional"}
                    </span>
                  </td>
                  <td className="muted" style={{ whiteSpace: "normal" }}>
                    {c.note}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="muted text-[11px] uppercase tracking-wider font-semibold mt-4 mb-2">
            Sample
          </div>
          <pre
            className="mono scroll"
            style={{
              background: "#1b1233",
              color: "#e2d9f8",
              padding: 12,
              borderRadius: 10,
              fontSize: 11,
              margin: 0,
            }}
          >
            {def.sample}
          </pre>
        </div>
      </div>
    </div>
  );
}
