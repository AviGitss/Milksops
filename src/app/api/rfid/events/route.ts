import { db, authorise, ok, fail, asArray } from "@/lib/api";

export const dynamic = "force-dynamic";

type Ev = {
  epc?: string;
  readerCode?: string;
  reader_code?: string;
  antenna?: number;
  rssi?: number;
  eventType?: string;
  event_type?: string;
  timestamp?: string;
  ts?: string;
  orderCode?: string;
  reasonCode?: string;
};

const VALID = ["read", "issue", "pack", "damaged", "dispatch", "return", "commission"];

/**
 * POST /api/rfid/events
 * Ingest passive-UHF reads from the RFID middleware.
 * Accepts a single event object, a bare array, or { events: [...] }.
 */
export async function POST(req: Request) {
  const denied = authorise(req);
  if (denied) return fail(denied, 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Body must be JSON", 400);
  }

  const events = asArray<Ev>(body, "events");
  if (events.length === 0) return fail("No events in payload", 400);
  if (events.length > 5000) return fail("Batch too large — max 5000 events per call", 413);

  const rejected: { index: number; reason: string }[] = [];
  const rows: Record<string, unknown>[] = [];

  // Resolve order codes once, so a 5000-read batch is still two queries.
  const codes = Array.from(
    new Set(events.map((e) => e.orderCode).filter(Boolean) as string[]),
  );
  const orderMap = new Map<string, string>();
  if (codes.length) {
    const { data } = await db
      .from("dispatch_orders")
      .select("id,order_code")
      .in("order_code", codes);
    (data ?? []).forEach((o) => orderMap.set(o.order_code, o.id));
  }

  events.forEach((e, i) => {
    const epc = (e.epc || "").trim().toUpperCase();
    const reader = (e.readerCode || e.reader_code || "").trim();
    const type = (e.eventType || e.event_type || "read").toLowerCase();
    if (!/^[0-9A-F]{16,32}$/.test(epc))
      return rejected.push({ index: i, reason: "epc must be 16-32 hex characters" });
    if (!reader) return rejected.push({ index: i, reason: "readerCode is required" });
    if (!VALID.includes(type))
      return rejected.push({ index: i, reason: `eventType must be one of ${VALID.join(", ")}` });

    rows.push({
      epc,
      reader_code: reader,
      antenna: e.antenna ?? null,
      rssi: e.rssi ?? null,
      event_type: type,
      ts: e.timestamp || e.ts || new Date().toISOString(),
      order_id: e.orderCode ? (orderMap.get(e.orderCode) ?? null) : null,
      reason_code: e.reasonCode ?? null,
      raw: e as unknown as Record<string, unknown>,
    });
  });

  if (rows.length === 0) return fail("All events rejected", 422, { rejected });

  const { error } = await db.from("rfid_events").insert(rows);
  if (error) return fail(error.message, 500, { rejected });

  // Roll the tag's lifecycle state forward from the strongest event seen.
  const rank: Record<string, number> = {
    commission: 1, issue: 2, pack: 3, dispatch: 4, damaged: 5, return: 6, read: 0,
  };
  const latest = new Map<string, string>();
  rows.forEach((r) => {
    const epc = r.epc as string;
    const t = r.event_type as string;
    if (!latest.has(epc) || rank[t] > rank[latest.get(epc)!]) latest.set(epc, t);
  });
  const statusFor: Record<string, string> = {
    commission: "commissioned", issue: "issued", pack: "packed",
    dispatch: "dispatched", damaged: "damaged", return: "returned",
  };
  await Promise.all(
    Array.from(latest.entries())
      .filter(([, t]) => statusFor[t])
      .map(([epc, t]) =>
        db
          .from("rfid_tags")
          .update({ status: statusFor[t], last_event_at: new Date().toISOString() })
          .eq("epc", epc),
      ),
  );

  const readers = Array.from(new Set(rows.map((r) => r.reader_code as string)));
  await Promise.all(
    readers.map((c) =>
      db
        .from("rfid_readers")
        .update({ last_seen_at: new Date().toISOString(), status: "online" })
        .eq("code", c),
    ),
  );

  return ok({ accepted: rows.length, rejected: rejected.length, errors: rejected });
}

/** GET /api/rfid/events?limit=50&reader=RDR-DK-D1 — recent reads, for polling clients. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || 50), 500);
  let q = db
    .from("rfid_events")
    .select("id,epc,reader_code,antenna,rssi,event_type,ts,reason_code")
    .order("ts", { ascending: false })
    .limit(limit);
  const reader = url.searchParams.get("reader");
  if (reader) q = q.eq("reader_code", reader);
  const { data, error } = await q;
  if (error) return fail(error.message, 500);
  return ok({ count: data?.length ?? 0, events: data });
}
