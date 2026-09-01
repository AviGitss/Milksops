import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * Server-side Supabase client used by the ingestion routes.
 * In production this should use the service-role key held only in Vercel env.
 */
export const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } },
);

/** Demo ingest key. Replace with per-device keys from the api_clients table. */
export const DEMO_KEY = process.env.INGEST_API_KEY || "onk_demo_key_2026";

export function authorise(req: Request) {
  const key =
    req.headers.get("x-api-key") ||
    (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!key) return "Missing x-api-key header";
  if (key !== DEMO_KEY) return "Invalid API key";
  return null;
}

export function ok(body: Record<string, unknown>, status = 200) {
  return NextResponse.json({ ok: true, ...body }, { status });
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

/** Accept either a single object or {events:[...]} / {tests:[...]} / a bare array. */
export function asArray<T>(body: unknown, key: string): T[] {
  if (Array.isArray(body)) return body as T[];
  const o = body as Record<string, unknown>;
  if (o && Array.isArray(o[key])) return o[key] as T[];
  if (o && typeof o === "object") return [o as T];
  return [];
}

/** Minimal CSV parser — handles quoted fields and \r\n. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (c !== "\r") cell += c;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const clean = rows.filter((r) => r.some((v) => v.trim() !== ""));
  if (clean.length < 2) return [];
  const head = clean[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return clean.slice(1).map((r) => {
    const o: Record<string, string> = {};
    head.forEach((h, i) => (o[h] = (r[i] ?? "").trim()));
    return o;
  });
}

/** Gross weight (g) from declared volume, density and tare. */
export function grossWeight(volumeMl: number, density: number, tare: number) {
  return volumeMl * density + tare;
}

/** Net volume (ml) back out of a measured gross weight. */
export function netVolume(grossG: number, density: number, tare: number) {
  return (grossG - tare) / density;
}

/** Density corrected to the measured temperature. */
export function densityAt(
  densityRef: number,
  tempC: number,
  refC = 27,
  coeff = 0.00028,
) {
  return densityRef * (1 - coeff * (tempC - refC));
}
