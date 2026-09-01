import { db, ok, fail } from "@/lib/api";

export const dynamic = "force-dynamic";

/** POST /api/leads — capture the visitor from the sign-in screen. */
export async function POST(req: Request) {
  let b: Record<string, string>;
  try {
    b = await req.json();
  } catch {
    return fail("Body must be JSON", 400);
  }

  const name = (b.fullName || "").trim();
  const email = (b.workEmail || "").trim().toLowerCase();
  if (name.length < 2) return fail("Please enter your name", 422);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email))
    return fail("Please enter a valid work email", 422);

  const { data: existing } = await db
    .from("leads")
    .select("id,visits")
    .eq("work_email", email)
    .maybeSingle();

  if (existing) {
    await db
      .from("leads")
      .update({
        full_name: name,
        company: b.company || null,
        job_title: b.jobTitle || null,
        phone: b.phone || null,
        plant_location: b.plantLocation || null,
        interest: b.interest || null,
        message: b.message || null,
        last_seen_at: new Date().toISOString(),
        visits: (existing.visits ?? 1) + 1,
      })
      .eq("id", existing.id);
    return ok({ leadId: existing.id, returning: true });
  }

  const { data, error } = await db
    .from("leads")
    .insert({
      full_name: name,
      work_email: email,
      company: b.company || null,
      job_title: b.jobTitle || null,
      phone: b.phone || null,
      plant_location: b.plantLocation || null,
      interest: b.interest || null,
      message: b.message || null,
      source: b.source || "dairyops-login",
    })
    .select("id")
    .single();

  if (error) return fail(error.message, 500);
  return ok({ leadId: data?.id, returning: false });
}
