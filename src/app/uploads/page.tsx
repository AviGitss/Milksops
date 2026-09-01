import { supabase } from "@/lib/supabase";
import { Card, Kpi, Pill } from "@/components/ui";
import Uploader from "@/components/Uploader";

export const dynamic = "force-dynamic";

export default async function UploadsPage() {
  const { data } = await supabase
    .from("data_uploads")
    .select("*")
    .order("uploaded_at", { ascending: false })
    .limit(40);

  const uploads = (data ?? []) as {
    id: string;
    source: string;
    file_name: string;
    uploaded_at: string;
    uploaded_by: string;
    rows_total: number;
    rows_accepted: number;
    rows_rejected: number;
    status: string;
    size_bytes: number;
  }[];

  const accepted = uploads.reduce((s, u) => s + (u.rows_accepted || 0), 0);
  const rejected = uploads.reduce((s, u) => s + (u.rows_rejected || 0), 0);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[24px] m-0">Data Uploads</h1>
        <p className="muted mt-1 mb-0 max-w-[900px]">
          Every input this plant produces has a file path and an API path. Where a
          device is already wired up, it POSTs; where it is a sheet, a slip or an
          export off a machine, it lands here. Each upload is validated row by row,
          graded against the configured specification, and written to an audit log
          you can trace a number back to.
        </p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Kpi label="Uploads logged" value={uploads.length} />
        <Kpi label="Rows accepted" value={accepted.toLocaleString("en-IN")} tone="ok" />
        <Kpi
          label="Rows rejected"
          value={rejected.toLocaleString("en-IN")}
          tone={rejected ? "warn" : "ok"}
          note="Validation failures, with the reason kept"
        />
        <Kpi
          label="Last upload"
          value={
            uploads[0]
              ? new Date(uploads[0].uploaded_at).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                })
              : "—"
          }
          tone="neutral"
          note={uploads[0]?.file_name ?? "nothing yet"}
        />
      </div>

      <Card
        title="Upload an input file"
        subtitle="Pick the input, drop the file. Templates match what the plant already produces."
      >
        <Uploader uploadedBy="web-upload" />
      </Card>

      <Card title="Upload history" subtitle="Auditable — file, who, rows in, rows kept, rows refused">
        <div className="scroll" style={{ maxHeight: 420 }}>
          <table className="grid">
            <thead>
              <tr>
                <th>When</th>
                <th>Input</th>
                <th>File</th>
                <th>By</th>
                <th>Rows</th>
                <th>Accepted</th>
                <th>Rejected</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {uploads.map((u) => (
                <tr key={u.id}>
                  <td className="mono muted">
                    {new Date(u.uploaded_at).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td>
                    <Pill tone="neutral">{u.source}</Pill>
                  </td>
                  <td className="mono">{u.file_name}</td>
                  <td className="muted">{u.uploaded_by}</td>
                  <td className="mono">{u.rows_total}</td>
                  <td className="mono">{u.rows_accepted}</td>
                  <td className="mono">{u.rows_rejected}</td>
                  <td>
                    <Pill
                      tone={
                        u.status === "processed" ? "ok" : u.status === "partial" ? "warn" : "bad"
                      }
                    >
                      {u.status}
                    </Pill>
                  </td>
                </tr>
              ))}
              {uploads.length === 0 && (
                <tr>
                  <td colSpan={8} className="muted">
                    No uploads yet — drop a file above to see it here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
