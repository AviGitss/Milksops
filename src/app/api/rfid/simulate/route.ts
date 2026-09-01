import { db, ok, fail } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * POST /api/rfid/simulate  — TEST STUB
 * Stands in for the real reader estate until the middleware is wired up.
 * Generates a burst of lifecycle-correct reads so the carton ledger has
 * something to reconcile. No API key: this route is demo-only and should be
 * deleted (or env-gated) before the plant pilot.
 *
 * Body: { count?: number, zone?: "store"|"line"|"dock"|"scrap" }
 */
export async function POST(req: Request) {
  let count = 40;
  let zone = "mixed";
  try {
    const b = await req.json();
    count = Math.min(Math.max(Number(b?.count) || 40, 1), 500);
    zone = b?.zone || "mixed";
  } catch {
    /* defaults are fine */
  }

  const { data: orders } = await db
    .from("dispatch_orders")
    .select("id")
    .order("dispatch_date", { ascending: false })
    .limit(6);
  const { data: cts } = await db.from("carton_types").select("id").limit(4);

  const hex = (n: number) =>
    Array.from({ length: n }, () =>
      "0123456789ABCDEF"[Math.floor(Math.random() * 16)],
    ).join("");

  const now = Date.now();
  const tags: Record<string, unknown>[] = [];
  const events: Record<string, unknown>[] = [];

  for (let i = 0; i < count; i++) {
    const epc = "E28011" + hex(18);
    const ct = cts?.[i % (cts?.length || 1)]?.id ?? null;
    const order = orders?.[i % (orders?.length || 1)]?.id ?? null;
    const roll = Math.random();

    const push = (
      reader: string,
      type: string,
      offsetMin: number,
      extra: Record<string, unknown> = {},
    ) =>
      events.push({
        epc,
        reader_code: reader,
        antenna: 1 + (i % 4),
        rssi: Number((-40 - Math.random() * 25).toFixed(2)),
        event_type: type,
        ts: new Date(now - offsetMin * 60000).toISOString(),
        raw: { epc, readerCode: reader, eventType: type, simulated: true },
        ...extra,
      });

    let status = "dispatched";
    push("RDR-CS-01", "issue", 180);
    if (zone === "store") {
      status = "issued";
    } else if (roll < 0.05 || zone === "scrap") {
      push("RDR-SCR-01", "damaged", 120, {
        reason_code: ["wet-carton", "erector-jam", "forklift-crush", "print-defect"][
          Math.floor(Math.random() * 4)
        ],
      });
      status = "damaged";
    } else if (roll < 0.08) {
      status = "unaccounted";
    } else {
      push(i % 2 ? "RDR-L1-01" : "RDR-L3-01", "pack", 90);
      if (zone !== "line") push(i % 3 ? "RDR-DK-D1" : "RDR-DK-D2", "dispatch", 20, { order_id: order });
      else status = "packed";
    }

    tags.push({
      epc,
      carton_type_id: ct,
      order_id: order,
      status,
      last_event_at: new Date(now).toISOString(),
    });
  }

  const t = await db.from("rfid_tags").upsert(tags, { onConflict: "epc" });
  if (t.error) return fail(t.error.message, 500);
  const e = await db.from("rfid_events").insert(events);
  if (e.error) return fail(e.error.message, 500);

  return ok({
    simulated: true,
    tags: tags.length,
    events: events.length,
    note: "Test stub — replace with the real reader middleware POSTing to /api/rfid/events",
  });
}
