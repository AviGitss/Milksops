import { db, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/health — readiness probe for the device gateways. */
export async function GET() {
  const started = Date.now();
  const { count, error } = await db
    .from("rfid_readers")
    .select("id", { count: "exact", head: true });
  return ok({
    service: "nandini-dairyops",
    database: error ? "error" : "up",
    readersRegistered: count ?? 0,
    latencyMs: Date.now() - started,
    time: new Date().toISOString(),
  });
}
