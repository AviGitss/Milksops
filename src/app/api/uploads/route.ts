import { db, ok, fail, parseCsv, netVolume } from "@/lib/api";

export const dynamic = "force-dynamic";

const SOURCES = ["weights", "quality", "cartons", "tankers", "dispatch", "rfid"] as const;
type Source = (typeof SOURCES)[number];

/**
 * POST /api/uploads   (multipart/form-data: file, source, uploadedBy)
 * One endpoint for every file-based input — checkweigher exports, random-sample
 * sheets, QA lab books, carton store slips, tanker bay logs, dispatch plans and
 * RFID reader dumps. Every upload is written to data_uploads for audit.
 */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("Expected multipart/form-data with a 'file' field", 400);
  }

  const file = form.get("file");
  const source = String(form.get("source") || "") as Source;
  const uploadedBy = String(form.get("uploadedBy") || "web-upload");

  if (!(file instanceof File)) return fail("No file supplied", 400);
  if (!SOURCES.includes(source))
    return fail(`source must be one of ${SOURCES.join(", ")}`, 400);
  if (file.size > 8 * 1024 * 1024) return fail("File larger than 8 MB", 413);

  const text = await file.text();
  const records = parseCsv(text);
  if (!records.length)
    return fail("Could not read any rows — expected a CSV with a header row", 422);

  const { data: upload } = await db
    .from("data_uploads")
    .insert({
      source,
      file_name: file.name,
      content_type: file.type || "text/csv",
      size_bytes: file.size,
      uploaded_by: uploadedBy,
      rows_total: records.length,
      status: "processing",
    })
    .select("id")
    .single();

  const uploadId = upload?.id ?? null;
  const errors: { row: number; reason: string }[] = [];
  let accepted = 0;

  const num = (v: string | undefined) => {
    const n = Number(String(v ?? "").replace(/[^0-9.\-]/g, ""));
    return isFinite(n) ? n : NaN;
  };

  try {
    if (source === "weights") {
      const [{ data: batches }, { data: machines }, { data: nozzles }, { data: formulas }] =
        await Promise.all([
          db.from("batches").select("id,batch_code,product_id,line_id"),
          db.from("machines").select("id,code"),
          db.from("nozzles").select("id,machine_id,nozzle_no"),
          db.from("fill_formulas").select("product_id,density_g_per_ml,tare_pack_g"),
        ]);
      const bMap = new Map((batches ?? []).map((b) => [b.batch_code, b]));
      const mMap = new Map((machines ?? []).map((m) => [m.code, m.id]));
      const fMap = new Map((formulas ?? []).map((f) => [f.product_id, f]));

      const rows = records.flatMap((r, i) => {
        const batch = bMap.get(r.batch_code || r.batch || "");
        if (!batch) {
          errors.push({ row: i + 2, reason: `batch_code '${r.batch_code || ""}' not found` });
          return [];
        }
        const w = num(r.net_weight_g ?? r.weight_g ?? r.weight ?? r.gross_weight_g);
        if (!isFinite(w) || w <= 0) {
          errors.push({ row: i + 2, reason: "net_weight_g missing or not numeric" });
          return [];
        }
        const mId = mMap.get(r.machine_code || r.machine || "") ?? null;
        const no = num(r.nozzle_no ?? r.nozzle) === 2 ? 2 : 1;
        const nId = mId
          ? ((nozzles ?? []).find((n) => n.machine_id === mId && n.nozzle_no === no)?.id ?? null)
          : null;
        const f = fMap.get(batch.product_id);
        return [
          {
            batch_id: batch.id,
            line_id: batch.line_id,
            product_id: batch.product_id,
            machine_id: mId,
            nozzle_id: nId,
            head_no: no,
            sampled_at: r.sampled_at || r.timestamp || new Date().toISOString(),
            net_weight_g: w,
            measured_volume_ml: f
              ? Number(netVolume(w, Number(f.density_g_per_ml), Number(f.tare_pack_g)).toFixed(2))
              : null,
            source: r.source || "upload",
            upload_id: uploadId,
          },
        ];
      });
      if (rows.length) {
        const { error } = await db.from("fill_samples").insert(rows);
        if (error) throw new Error(error.message);
        accepted = rows.length;
      }
    } else if (source === "quality") {
      const [{ data: prods }, { data: batches }] = await Promise.all([
        db.from("products").select("id,sku_code,fat_min,snf_min"),
        db.from("batches").select("id,batch_code,product_id"),
      ]);
      const pMap = new Map((prods ?? []).map((p) => [p.sku_code, p]));
      const bMap = new Map((batches ?? []).map((b) => [b.batch_code, b]));

      const rows = records.flatMap((r, i) => {
        const batch = bMap.get(r.batch_code || "");
        const prod = pMap.get(r.sku || r.sku_code || "");
        const productId = prod?.id ?? batch?.product_id;
        if (!productId) {
          errors.push({ row: i + 2, reason: "sku or batch_code must resolve to a product" });
          return [];
        }
        const fat = num(r.fat_pct ?? r.fat);
        const snf = num(r.snf_pct ?? r.snf);
        if (!isFinite(fat) || !isFinite(snf)) {
          errors.push({ row: i + 2, reason: "fat_pct / snf_pct missing or not numeric" });
          return [];
        }
        const fatMin = prod ? Number(prod.fat_min) : NaN;
        const snfMin = prod ? Number(prod.snf_min) : NaN;
        let result = "pass";
        if (isFinite(fatMin)) {
          if (fat < fatMin - 0.05 || snf < snfMin - 0.05) result = "fail";
          else if (fat < fatMin || snf < snfMin) result = "marginal";
        }
        return [
          {
            batch_id: batch?.id ?? null,
            product_id: productId,
            sample_point: (r.sample_point || "packed").toLowerCase(),
            tested_at: r.tested_at || new Date().toISOString(),
            fat_pct: fat,
            snf_pct: snf,
            temperature_c: isFinite(num(r.temperature_c)) ? num(r.temperature_c) : null,
            method: r.method || "lab-upload",
            tested_by: r.tested_by || uploadedBy,
            entry_method: "upload",
            upload_id: uploadId,
            result,
          },
        ];
      });
      if (rows.length) {
        const { error } = await db.from("quality_tests").insert(rows);
        if (error) throw new Error(error.message);
        accepted = rows.length;
      }
    } else if (source === "cartons") {
      const [{ data: cts }, { data: plants }, { data: lines }] = await Promise.all([
        db.from("carton_types").select("id,code"),
        db.from("plants").select("id").limit(1),
        db.from("lines").select("id,code"),
      ]);
      const ctMap = new Map((cts ?? []).map((c) => [c.code, c.id]));
      const lMap = new Map((lines ?? []).map((l) => [l.code, l.id]));
      const plantId = plants?.[0]?.id ?? null;

      const rows = records.flatMap((r, i) => {
        const qty = num(r.qty ?? r.quantity);
        const type = (r.txn_type || r.movement || "").toLowerCase();
        if (!isFinite(qty) || qty <= 0) {
          errors.push({ row: i + 2, reason: "qty missing or not numeric" });
          return [];
        }
        if (!["issue", "used", "damaged", "returned", "receipt"].includes(type)) {
          errors.push({ row: i + 2, reason: `txn_type '${type}' not recognised` });
          return [];
        }
        return [
          {
            plant_id: plantId,
            carton_type_id: ctMap.get(r.carton_type || r.carton_code || "") ?? null,
            line_id: lMap.get(r.line_code || "") ?? null,
            txn_date: r.txn_date || new Date().toISOString().slice(0, 10),
            shift: r.shift || "A",
            txn_type: type,
            qty,
            reason_code: r.reason_code || null,
            recorded_by: uploadedBy,
            ref_no: r.ref_no || `UPL-${(uploadId || "").slice(0, 6)}`,
          },
        ];
      });
      if (rows.length) {
        const { error } = await db.from("carton_txns").insert(rows);
        if (error) throw new Error(error.message);
        accepted = rows.length;
      }
    } else if (source === "tankers") {
      const { data: plants } = await db.from("plants").select("id").limit(1);
      const rows = records.flatMap((r, i) => {
        const qty = num(r.qty_litres ?? r.quantity ?? r.litres);
        if (!r.tanker_no || !isFinite(qty)) {
          errors.push({ row: i + 2, reason: "tanker_no and qty_litres are required" });
          return [];
        }
        return [
          {
            plant_id: plants?.[0]?.id ?? null,
            tanker_no: r.tanker_no,
            society_code: r.society_code || null,
            received_at: r.received_at || new Date().toISOString(),
            qty_litres: qty,
            fat_pct: isFinite(num(r.fat_pct)) ? num(r.fat_pct) : null,
            snf_pct: isFinite(num(r.snf_pct)) ? num(r.snf_pct) : null,
            clr: isFinite(num(r.clr)) ? num(r.clr) : null,
            temperature_c: isFinite(num(r.temperature_c)) ? num(r.temperature_c) : null,
            accepted: (r.accepted || "true").toLowerCase() !== "false",
            remarks: r.remarks || null,
          },
        ];
      });
      if (rows.length) {
        const { error } = await db.from("tanker_receipts").insert(rows);
        if (error) throw new Error(error.message);
        accepted = rows.length;
      }
    } else if (source === "rfid") {
      const rows = records.flatMap((r, i) => {
        const epc = (r.epc || "").toUpperCase();
        if (!/^[0-9A-F]{16,32}$/.test(epc)) {
          errors.push({ row: i + 2, reason: "epc must be 16-32 hex characters" });
          return [];
        }
        return [
          {
            epc,
            reader_code: r.reader_code || r.reader || "UPLOAD",
            antenna: isFinite(num(r.antenna)) ? num(r.antenna) : null,
            rssi: isFinite(num(r.rssi)) ? num(r.rssi) : null,
            event_type: (r.event_type || "read").toLowerCase(),
            ts: r.ts || r.timestamp || new Date().toISOString(),
            reason_code: r.reason_code || null,
            raw: { ...r, viaUpload: true },
          },
        ];
      });
      if (rows.length) {
        const { error } = await db.from("rfid_events").insert(rows);
        if (error) throw new Error(error.message);
        accepted = rows.length;
      }
    } else if (source === "dispatch") {
      const rows = records.flatMap((r, i) => {
        if (!r.order_code) {
          errors.push({ row: i + 2, reason: "order_code is required" });
          return [];
        }
        return [r];
      });
      for (const r of rows) {
        await db
          .from("dispatch_orders")
          .update({
            truck_no: r.truck_no || null,
            transporter: r.transporter || null,
            driver_name: r.driver_name || null,
            driver_phone: r.driver_phone || null,
            packing_person: r.packing_person || null,
            gate_pass_no: r.gate_pass_no || null,
          })
          .eq("order_code", r.order_code);
      }
      accepted = rows.length;
    }
  } catch (e) {
    await db
      .from("data_uploads")
      .update({
        status: "failed",
        rows_accepted: 0,
        rows_rejected: records.length,
        notes: (e as Error).message,
      })
      .eq("id", uploadId);
    return fail((e as Error).message, 500, { uploadId });
  }

  await db
    .from("data_uploads")
    .update({
      status: errors.length && !accepted ? "failed" : errors.length ? "partial" : "processed",
      rows_accepted: accepted,
      rows_rejected: errors.length,
      errors: errors.slice(0, 50),
    })
    .eq("id", uploadId);

  return ok({
    uploadId,
    source,
    fileName: file.name,
    rowsTotal: records.length,
    accepted,
    rejected: errors.length,
    errors: errors.slice(0, 20),
  });
}
