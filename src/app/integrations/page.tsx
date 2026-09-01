import { Card, Pill } from "@/components/ui";

export const dynamic = "force-dynamic";

function Code({ children }: { children: string }) {
  return (
    <pre
      className="mono scroll"
      style={{
        background: "#1b1233",
        color: "#e2d9f8",
        padding: 14,
        borderRadius: 10,
        fontSize: 11.5,
        lineHeight: 1.55,
        margin: "10px 0 0",
      }}
    >
      {children}
    </pre>
  );
}

function Endpoint({
  method,
  path,
  auth,
  purpose,
}: {
  method: string;
  path: string;
  auth: boolean;
  purpose: string;
}) {
  return (
    <tr>
      <td>
        <Pill tone={method === "GET" ? "neutral" : "ok"}>{method}</Pill>
      </td>
      <td className="mono">{path}</td>
      <td>{auth ? <Pill tone="warn">x-api-key</Pill> : <Pill tone="neutral">open</Pill>}</td>
      <td style={{ whiteSpace: "normal" }} className="muted">
        {purpose}
      </td>
    </tr>
  );
}

export default function IntegrationsPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[24px] m-0">Device &amp; System Interfaces</h1>
        <p className="muted mt-1 mb-0 max-w-[920px]">
          Everything the plant floor produces reaches DairyOps one of three ways: a
          device POSTs it, an operator keys it on an HMI screen, or a file is
          uploaded. All three land in the same tables and are graded by the same
          rules, so a number is never trusted more because of how it arrived — only
          tagged with how it did.
        </p>
      </div>

      <Card title="Endpoint map" subtitle="Base URL is this deployment's origin">
        <table className="grid">
          <thead>
            <tr>
              <th>Method</th>
              <th>Path</th>
              <th>Auth</th>
              <th style={{ whiteSpace: "normal" }}>Purpose</th>
            </tr>
          </thead>
          <tbody>
            <Endpoint method="POST" path="/api/rfid/events" auth purpose="Carton tag reads from the reader middleware — the main RFID path" />
            <Endpoint method="GET" path="/api/rfid/events" auth={false} purpose="Recent reads, for polling clients and the live feed" />
            <Endpoint method="POST" path="/api/rfid/commission" auth purpose="Register newly encoded tags against a carton type" />
            <Endpoint method="POST" path="/api/rfid/simulate" auth={false} purpose="TEST STUB — generates lifecycle-correct reads until the portals are live" />
            <Endpoint method="POST" path="/api/quality/tests" auth purpose="Fat / SNF from the milko-analyser bridge or the HMI" />
            <Endpoint method="GET" path="/api/quality/tests" auth={false} purpose="Read results back for the HMI and round-trip checks" />
            <Endpoint method="POST" path="/api/fill/samples" auth purpose="Checkweigher stream and random-sample weights" />
            <Endpoint method="POST" path="/api/uploads" auth={false} purpose="Multipart CSV for any input (see Data Uploads)" />
            <Endpoint method="POST" path="/api/leads" auth={false} purpose="Lead capture from the sign-in screen" />
            <Endpoint method="GET" path="/api/health" auth={false} purpose="Readiness probe for the device gateways" />
          </tbody>
        </table>
        <p className="muted text-[12px] mt-3 mb-0">
          Demo key for every authenticated route:{" "}
          <span className="mono">x-api-key: onk_demo_key_2026</span>. In production
          each device gets its own key, checked against the{" "}
          <span className="mono">api_clients</span> table.
        </p>
      </Card>

      <Card
        title="1 · Carton RFID — how to interface"
        subtitle="Passive UHF (EPC Gen2 / ISO 18000-6C) tag on every carton, fixed portals at four points"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="text-[13px]">
            <p className="mt-0">
              <strong>The chain.</strong> Tag → antenna → fixed reader → middleware →
              this API. DairyOps deliberately does not talk to readers directly:
              readers speak LLRP over a raw TCP socket, which a serverless app
              cannot hold open. A small middleware process on the plant LAN owns the
              reader sessions and pushes clean, de-duplicated events out over HTTPS.
            </p>
            <ol className="mt-3" style={{ paddingLeft: 18 }}>
              <li>
                <strong>Tag &amp; encode.</strong> Apply a wet inlay (Impinj M730 or
                NXP UCODE 9 class) to each carton at the erector or at the box
                supplier. Encode a 96-bit EPC — SGTIN-96 with your GS1 company
                prefix is the right long-term choice; the demo accepts any 16–32 hex
                characters. POST the encoded tags to{" "}
                <span className="mono">/api/rfid/commission</span>.
              </li>
              <li>
                <strong>Mount portals.</strong> Four zones, and they matter more than
                the reader brand: <em>store issue gate</em> (what left the store),{" "}
                <em>line erector</em> (what actually got used), <em>scrap bin</em>{" "}
                (what broke, with a reason on the bin HMI), <em>dock</em> (what
                shipped). Circular-polarised antennas, 4 on a dock portal, 2
                elsewhere. Set read power around 27–30 dBm and tune down until
                cross-reads from the next aisle stop.
              </li>
              <li>
                <strong>Middleware.</strong> Run one process per plant — Impinj
                Octane SDK, Zebra FX Connect, or plain <span className="mono">sllurp</span>{" "}
                in Python. Its job: hold the LLRP session, de-duplicate (a tag on a
                pallet reads 40 times a second), apply a 3-second glimpse window per
                EPC per reader, decide the event type from which reader saw it, and
                batch up to 500 events per POST.
              </li>
              <li>
                <strong>Buffer and retry.</strong> The plant network will drop. Queue
                to local disk (SQLite is plenty) and replay on reconnect — events
                carry their own timestamp, so late arrival is harmless. The ingest
                route is idempotent-friendly: replaying a batch adds duplicate reads,
                so key your queue on (epc, reader, second).
              </li>
            </ol>
            <p className="muted">
              Sizing note: at 1 lakh cartons a day with four read points, expect
              ~400k events daily. Batched at 500 per POST that is ~800 calls a day —
              trivial. Keep 90 days hot and roll older events to cold storage.
            </p>
          </div>
          <div>
            <div className="muted text-[11px] uppercase tracking-wider font-semibold">
              Reader middleware → DairyOps
            </div>
            <Code>{`curl -X POST https://<your-app>/api/rfid/events \\
  -H "x-api-key: onk_demo_key_2026" \\
  -H "Content-Type: application/json" \\
  -d '{
    "events": [
      {
        "epc": "E28011A1B2C3D4E5F6071819",
        "readerCode": "RDR-DK-D1",
        "antenna": 2,
        "rssi": -52.4,
        "eventType": "dispatch",
        "timestamp": "2026-08-31T10:02:11+05:30",
        "orderCode": "DO260831-001"
      },
      {
        "epc": "E28011A1B2C3D4E5F607181A",
        "readerCode": "RDR-SCR-01",
        "eventType": "damaged",
        "reasonCode": "forklift-crush"
      }
    ]
  }'

# 200 OK
# { "ok": true, "accepted": 2, "rejected": 0, "errors": [] }`}</Code>

            <div className="muted text-[11px] uppercase tracking-wider font-semibold mt-4">
              Minimal middleware loop (Python + sllurp)
            </div>
            <Code>{`from sllurp import llrp
import requests, time

SEEN, WINDOW = {}, 3.0          # glimpse window, seconds
API = "https://<your-app>/api/rfid/events"
KEY = {"x-api-key": "onk_demo_key_2026"}
READER, EVENT = "RDR-DK-D1", "dispatch"
buf = []

def on_tags(reader, tags):
    now = time.time()
    for t in tags:
        epc = t["EPC-96"].decode().upper()
        if now - SEEN.get(epc, 0) < WINDOW:   # de-duplicate
            continue
        SEEN[epc] = now
        buf.append({"epc": epc, "readerCode": READER,
                    "antenna": t.get("AntennaID"),
                    "rssi": t.get("PeakRSSI"),
                    "eventType": EVENT,
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S%z")})
    if len(buf) >= 200:
        flush()

def flush():
    if not buf: return
    try:
        requests.post(API, json={"events": buf}, headers=KEY, timeout=10)
        buf.clear()
    except Exception:
        pass                     # keep buffered; retry next flush

factory = llrp.LLRPClientFactory(report_every_n_tags=50,
                                 tag_content_selector={"EnableRSSI": True})
factory.addTagReportCallback(on_tags)`}</Code>

            <div className="muted text-[11px] uppercase tracking-wider font-semibold mt-4">
              Event types and what each portal means
            </div>
            <table className="grid">
              <thead>
                <tr>
                  <th>eventType</th>
                  <th>Raised at</th>
                  <th style={{ whiteSpace: "normal" }}>Ledger effect</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["commission", "Encoding station", "Tag exists; not yet in stock"],
                  ["issue", "Store issue gate", "Leaves the carton store — opens the balance"],
                  ["pack", "Line erector portal", "Actually consumed on the line"],
                  ["damaged", "Scrap bin reader", "Written off, with a reason code"],
                  ["dispatch", "Dock portal", "Left the plant against an order"],
                  ["return", "Returns gate", "Came back — closes the balance"],
                ].map(([a, b, c]) => (
                  <tr key={a}>
                    <td className="mono">{a}</td>
                    <td>{b}</td>
                    <td className="muted" style={{ whiteSpace: "normal" }}>
                      {c}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      <Card
        title="2 · Fat &amp; SNF — where the data comes from"
        subtitle="Today it is a lab register; this is how it becomes a monitored signal"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="text-[13px]">
            <p className="mt-0">
              You asked where the fat/SNF numbers come from. In most cooperative
              plants they come from three places, and DairyOps takes all three
              through one contract:
            </p>
            <table className="grid mt-2">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Path</th>
                  <th style={{ whiteSpace: "normal" }}>What it needs</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Milko-analyser at the tanker bay / QA bench</td>
                  <td>
                    <Pill tone="ok">API</Pill>
                  </td>
                  <td className="muted" style={{ whiteSpace: "normal" }}>
                    Most units (Lactoscan, Milkotester, Ekomilk) print to RS-232 or
                    write a CSV. A ₹3,000 serial-to-Ethernet bridge or a small PC
                    watcher turns each print into one POST.
                  </td>
                </tr>
                <tr>
                  <td>Inline IR analyser after standardisation</td>
                  <td>
                    <Pill tone="ok">API</Pill>
                  </td>
                  <td className="muted" style={{ whiteSpace: "normal" }}>
                    If one is fitted, it usually exposes Modbus TCP. Poll the fat and
                    SNF registers every 30 s in the same middleware that runs the
                    RFID readers, and POST on change.
                  </td>
                </tr>
                <tr>
                  <td>Gerber / manual bench test</td>
                  <td>
                    <Pill tone="warn">HMI</Pill>
                  </td>
                  <td className="muted" style={{ whiteSpace: "normal" }}>
                    No device to integrate — the analyst keys it on the entry panel
                    on the Fat / SNF page. Stored with{" "}
                    <span className="mono">entry_method = hmi</span> so a manual
                    number is never mistaken for an instrument reading.
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="muted mt-3">
              Grading happens on ingest, not on display: each result is compared
              with that SKU&apos;s declared fat and SNF minima and marked pass,
              marginal or fail, and a failing result raises a priced alert
              immediately. That is what turns a lab register into a control.
            </p>
          </div>
          <div>
            <div className="muted text-[11px] uppercase tracking-wider font-semibold">
              Analyser bridge → DairyOps
            </div>
            <Code>{`curl -X POST https://<your-app>/api/quality/tests \\
  -H "x-api-key: onk_demo_key_2026" \\
  -H "Content-Type: application/json" \\
  -d '{
    "tests": [{
      "sku": "NTM500",
      "batchCode": "B260831-0001",
      "samplePoint": "packed",
      "fatPct": 3.04,
      "snfPct": 8.61,
      "temperatureC": 5.2,
      "method": "milko-analyser",
      "deviceId": "LACTOSCAN-QA-02",
      "operatorId": "QA-Suma",
      "testedAt": "2026-08-31T07:40:00+05:30"
    }]
  }'

# { "ok": true, "accepted": 1, "rejected": 0, "alertsRaised": 0 }`}</Code>

            <div className="muted text-[11px] uppercase tracking-wider font-semibold mt-4">
              Serial analyser → HTTP, in about 20 lines
            </div>
            <Code>{`import serial, re, requests

ser = serial.Serial("/dev/ttyUSB0", 9600, timeout=5)
API = "https://<your-app>/api/quality/tests"
KEY = {"x-api-key": "onk_demo_key_2026"}

# Lactoscan print line, e.g.:  FAT 3.04 SNF 8.61 TEMP 5.2
PAT = re.compile(r"FAT\\s+([\\d.]+).*SNF\\s+([\\d.]+).*TEMP\\s+([\\d.]+)")

while True:
    line = ser.readline().decode(errors="ignore")
    m = PAT.search(line)
    if not m:
        continue
    fat, snf, temp = map(float, m.groups())
    requests.post(API, headers=KEY, json={"tests": [{
        "sku": CURRENT_SKU,            # from the HMI batch selector
        "batchCode": CURRENT_BATCH,
        "samplePoint": "packed",
        "fatPct": fat, "snfPct": snf, "temperatureC": temp,
        "method": "milko-analyser", "deviceId": "LACTOSCAN-QA-02"}]})`}</Code>
          </div>
        </div>
      </Card>

      <Card
        title="3 · Checkweigher — fill weights"
        subtitle="The same contract, with machine and nozzle attached"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="text-[13px]">
            <p className="mt-0">
              A weight without a nozzle number is only enough to reject a batch. With
              it, the fault is a nozzle timing valve on one machine out of seventy and
              the rest of the batch ships. Whatever the checkweigher can tell you —
              machine, lane, head — put it in the payload.
            </p>
            <p className="muted">
              If the checkweigher is on the closed SCADA side and cannot be tapped,
              the fallback is the random-sample scale: the QA operator weighs a pouch,
              keys the machine and nozzle, and the same record is created. That path
              runs through <span className="mono">/api/uploads</span> or the weight
              upload screen.
            </p>
          </div>
          <div>
            <Code>{`curl -X POST https://<your-app>/api/fill/samples \\
  -H "x-api-key: onk_demo_key_2026" \\
  -H "Content-Type: application/json" \\
  -d '{
    "samples": [
      {"batchCode":"B260831-0001","machineCode":"FM-012",
       "nozzleNo":1,"netWeightG":520.4,"source":"checkweigher"},
      {"batchCode":"B260831-0001","machineCode":"FM-012",
       "nozzleNo":2,"netWeightG":515.9,"source":"checkweigher"}
    ]
  }'`}</Code>
            <p className="muted text-[12px] mt-3 mb-0">
              Measured volume is derived on ingest from the SKU&apos;s configured
              density and tare, so the volume the consumer receives is stored
              alongside the weight the scale saw.
            </p>
          </div>
        </div>
      </Card>

      <Card title="4 · SCADA historian" subtitle="Read-only, no write-back">
        <p className="text-[13px] m-0">
          Unchanged from the original design: a scheduled CSV or SQL dump from the
          historian lands on an SFTP drop, is tag-mapped and time-aligned to batches.
          Because it arrives after the fact it informs root cause, never control — the
          four live controls above all run on instrumentation the plant owns outright.
          If the OEM ever opens a read-only OPC-UA endpoint, the same tag map switches
          from batch import to streaming with no application change.
        </p>
      </Card>

      <Card title="Before the plant pilot" subtitle="What has to change from this demo build">
        <ul className="text-[13px]" style={{ paddingLeft: 18, margin: 0 }}>
          <li>
            Replace the shared demo key with one key per device, verified against{" "}
            <span className="mono">api_clients</span>, and move ingest to the
            service-role key held only in the server environment.
          </li>
          <li>
            Delete or env-gate <span className="mono">/api/rfid/simulate</span> — a
            stub that writes to the same tables as the readers must not exist in
            production.
          </li>
          <li>
            Replace the lead-capture gate with Supabase Auth and role-based
            policies: operator, QA, dock supervisor, plant manager.
          </li>
          <li>
            Add a de-duplication key on (epc, reader_code, second) so a middleware
            replay after a network drop cannot double-count cartons.
          </li>
          <li>
            Rate-limit the ingest routes and add a dead-letter table for rejected
            rows, so a misconfigured reader is visible rather than silent.
          </li>
        </ul>
      </Card>
    </div>
  );
}
