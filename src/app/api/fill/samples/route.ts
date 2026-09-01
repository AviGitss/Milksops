import { db, authorise, ok, fail, asArray, netVolume } from "@/lib/api";

export const dynamic = "force-dynamic";

type S = {
  batchCode?: string;
  sku?: string;
  machineCode?: string;
  nozzleNo?: number | string;
  netWeightG?: number | string;
  weight?: number | string;
  sampledAt?: string;
  source?: string;
};

/**
 * POST /api/fill/samples
 * Checkweigher stream, or a random-sample scale on the floor.
 * Machine + nozzle are what turn a weight reading into a fixable fault.
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
  const samples = asArray<S>(body, "samples");
  if (!samples.length) return fail("No samples in payload", 400);
  if (samples.length > 5000) return fail("Batch too large — max 5000 samples per call", 413);

  const machineCodes = Array.from(
    new Set(samples.map((s) => s.machineCode).filter(Boolean) as string[]),
  );
  const batchCodes = Array.from(
    new Set(samples.map((s) => s.batchCode).filter(Boolean) as string[]),
  );

  const [{ data: machines }, { data: nozzles }, { data: batches }, { data: formulas }] =
    await Promise.all([
      machineCodes.length
        ? db.from("machines").select("id,code,line_id").in("code", machineCodes)
        : Promise.resolve({ data: [] as { id: string; code: string; line_id: string }[] }),
      db.from("nozzles").select("id,machine_id,nozzle_no"),
      batchCodes.length
        ? db.from("batches").select("id,batch_code,product_id,line_id").in("batch_code", batchCodes)
        : Promise.resolve({
            data: [] as { id: string; batch_code: string; product_id: string; line_id: string }[],
          }),
      db.from("fill_formulas").select("product_id,density_g_per_ml,tare_pack_g"),
    ]);

  const mByCode = new Map((machines ?? []).map((m) => [m.code, m]));
  const bByCode = new Map((batches ?? []).map((b) => [b.batch_code, b]));
  const fByProduct = new Map((formulas ?? []).map((f) => [f.product_id, f]));
  const nozzleOf = (machineId: string, no: number) =>
    (nozzles ?? []).find((n) => n.machine_id === machineId && n.nozzle_no === no)?.id ?? null;

  const rejected: { index: number; reason: string }[] = [];
  const rows: Record<string, unknown>[] = [];

  samples.forEach((s, i) => {
    const batch = s.batchCode ? bByCode.get(s.batchCode) : undefined;
    if (!batch) return rejected.push({ index: i, reason: "batchCode not found" });

    const w = Number(s.netWeightG ?? s.weight);
    if (!isFinite(w) || w <= 0)
      return rejected.push({ index: i, reason: "netWeightG must be a positive number" });

    const machine = s.machineCode ? mByCode.get(s.machineCode) : undefined;
    const no = Number(s.nozzleNo ?? 1);
    const f = fByProduct.get(batch.product_id);

    rows.push({
      batch_id: batch.id,
      line_id: batch.line_id,
      product_id: batch.product_id,
      machine_id: machine?.id ?? null,
      nozzle_id: machine ? nozzleOf(machine.id, no === 2 ? 2 : 1) : null,
      head_no: no === 2 ? 2 : 1,
      sampled_at: s.sampledAt || new Date().toISOString(),
      net_weight_g: w,
      measured_volume_ml: f
        ? Number(netVolume(w, Number(f.density_g_per_ml), Number(f.tare_pack_g)).toFixed(2))
        : null,
      source: s.source || "checkweigher",
    });
  });

  if (!rows.length) return fail("All samples rejected", 422, { rejected });

  const { error } = await db.from("fill_samples").insert(rows);
  if (error) return fail(error.message, 500, { rejected });

  return ok({ accepted: rows.length, rejected: rejected.length, errors: rejected });
}
