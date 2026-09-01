import { db, authorise, ok, fail, asArray } from "@/lib/api";

export const dynamic = "force-dynamic";

type QT = {
  sku?: string;
  batchCode?: string;
  samplePoint?: string;
  fatPct?: number | string;
  snfPct?: number | string;
  temperatureC?: number | string;
  ph?: number | string;
  phosphatasePass?: boolean;
  testedAt?: string;
  testedBy?: string;
  method?: string;
  deviceId?: string;
  operatorId?: string;
};

const POINTS = ["raw", "silo", "standardised", "pasteuriser", "packed"];

/**
 * POST /api/quality/tests
 * Fat / SNF results from the milko-analyser bridge, an inline IR analyser,
 * or the HMI screen at /quality. Same contract for all three.
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
  const tests = asArray<QT>(body, "tests");
  if (!tests.length) return fail("No tests in payload", 400);

  const skus = Array.from(new Set(tests.map((t) => t.sku).filter(Boolean) as string[]));
  const batchCodes = Array.from(
    new Set(tests.map((t) => t.batchCode).filter(Boolean) as string[]),
  );

  const [{ data: prods }, { data: batches }] = await Promise.all([
    db.from("products").select("id,sku_code,fat_min,snf_min,fat_max,snf_max"),
    batchCodes.length
      ? db.from("batches").select("id,batch_code,product_id").in("batch_code", batchCodes)
      : Promise.resolve({ data: [] as { id: string; batch_code: string; product_id: string }[] }),
  ]);

  const pBySku = new Map((prods ?? []).map((p) => [p.sku_code, p]));
  const bByCode = new Map((batches ?? []).map((b) => [b.batch_code, b]));

  const rejected: { index: number; reason: string }[] = [];
  const rows: Record<string, unknown>[] = [];
  const alerts: Record<string, unknown>[] = [];

  tests.forEach((t, i) => {
    const batch = t.batchCode ? bByCode.get(t.batchCode) : undefined;
    const prod = t.sku ? pBySku.get(t.sku) : undefined;
    const productId = prod?.id ?? batch?.product_id;
    if (!productId)
      return rejected.push({ index: i, reason: "sku or batchCode must resolve to a product" });

    const fat = Number(t.fatPct);
    const snf = Number(t.snfPct);
    if (!isFinite(fat) || fat < 0 || fat > 15)
      return rejected.push({ index: i, reason: "fatPct must be a number between 0 and 15" });
    if (!isFinite(snf) || snf < 0 || snf > 15)
      return rejected.push({ index: i, reason: "snfPct must be a number between 0 and 15" });

    const point = (t.samplePoint || "packed").toLowerCase();
    if (!POINTS.includes(point))
      return rejected.push({ index: i, reason: `samplePoint must be one of ${POINTS.join(", ")}` });

    const spec = prod ?? pBySku.get("") ?? null;
    const fatMin = spec ? Number(spec.fat_min) : NaN;
    const snfMin = spec ? Number(spec.snf_min) : NaN;
    let result = "pass";
    if (isFinite(fatMin) && isFinite(snfMin)) {
      if (fat < fatMin - 0.05 || snf < snfMin - 0.05) result = "fail";
      else if (fat < fatMin || snf < snfMin) result = "marginal";
    }

    const testedAt = t.testedAt || new Date().toISOString();
    rows.push({
      batch_id: batch?.id ?? null,
      product_id: productId,
      sample_point: point,
      tested_at: testedAt,
      fat_pct: fat,
      snf_pct: snf,
      temperature_c: t.temperatureC != null ? Number(t.temperatureC) : null,
      ph: t.ph != null ? Number(t.ph) : null,
      phosphatase_pass: t.phosphatasePass ?? null,
      method: t.method || "milko-analyser",
      tested_by: t.testedBy || null,
      entry_method: t.deviceId ? "analyser-api" : "hmi",
      device_id: t.deviceId || null,
      operator_id: t.operatorId || null,
      result,
    });

    if (result !== "pass") {
      alerts.push({
        created_at: testedAt,
        module: "quality",
        severity: result === "fail" ? "critical" : "warning",
        title: `Fat/SNF out of specification — ${t.sku || t.batchCode}`,
        detail: `At ${point}: fat ${fat}% (spec min ${fatMin}%), SNF ${snf}% (spec min ${snfMin}%).`,
        batch_id: batch?.id ?? null,
        status: "open",
        est_impact_inr: result === "fail" ? 45000 : 12000,
      });
    }
  });

  if (!rows.length) return fail("All tests rejected", 422, { rejected });

  const { error } = await db.from("quality_tests").insert(rows);
  if (error) return fail(error.message, 500, { rejected });
  if (alerts.length) await db.from("alerts").insert(alerts);

  return ok({
    accepted: rows.length,
    rejected: rejected.length,
    alertsRaised: alerts.length,
    errors: rejected,
  });
}

/** GET /api/quality/tests?limit=25 — read back for the HMI and for analyser round-trip checks. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || 25), 500);
  const { data, error } = await db
    .from("quality_tests")
    .select("id,sample_point,tested_at,fat_pct,snf_pct,result,entry_method,device_id,tested_by")
    .order("tested_at", { ascending: false })
    .limit(limit);
  if (error) return fail(error.message, 500);
  return ok({ count: data?.length ?? 0, tests: data });
}
