import { db, authorise, ok, fail, asArray } from "@/lib/api";

export const dynamic = "force-dynamic";

type T = { epc?: string; tid?: string; cartonTypeCode?: string; sku?: string };

/**
 * POST /api/rfid/commission
 * Register newly encoded passive tags against a carton type before they enter the store.
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
  const tags = asArray<T>(body, "tags");
  if (!tags.length) return fail("No tags in payload", 400);

  const [{ data: cts }, { data: prods }] = await Promise.all([
    db.from("carton_types").select("id,code"),
    db.from("products").select("id,sku_code"),
  ]);
  const ctMap = new Map((cts ?? []).map((c) => [c.code, c.id]));
  const pMap = new Map((prods ?? []).map((p) => [p.sku_code, p.id]));

  const rejected: { index: number; reason: string }[] = [];
  const rows = tags.flatMap((t, i) => {
    const epc = (t.epc || "").trim().toUpperCase();
    if (!/^[0-9A-F]{16,32}$/.test(epc)) {
      rejected.push({ index: i, reason: "epc must be 16-32 hex characters" });
      return [];
    }
    return [
      {
        epc,
        tid: t.tid ?? null,
        carton_type_id: t.cartonTypeCode ? (ctMap.get(t.cartonTypeCode) ?? null) : null,
        product_id: t.sku ? (pMap.get(t.sku) ?? null) : null,
        status: "commissioned",
      },
    ];
  });

  if (!rows.length) return fail("All tags rejected", 422, { rejected });

  const { error } = await db.from("rfid_tags").upsert(rows, { onConflict: "epc" });
  if (error) return fail(error.message, 500, { rejected });

  return ok({ commissioned: rows.length, rejected: rejected.length, errors: rejected });
}
