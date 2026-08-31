import React from "react";

export function Card({
  title,
  subtitle,
  right,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || right) && (
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            {title && (
              <h3 className="text-[15px] leading-tight m-0">{title}</h3>
            )}
            {subtitle && (
              <p className="muted text-[12px] mt-1 mb-0">{subtitle}</p>
            )}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({
  label,
  value,
  unit,
  tone = "neutral",
  note,
}: {
  label: string;
  value: string | number;
  unit?: string;
  tone?: "ok" | "warn" | "bad" | "neutral";
  note?: string;
}) {
  const color =
    tone === "ok"
      ? "var(--ok)"
      : tone === "warn"
        ? "var(--warn)"
        : tone === "bad"
          ? "var(--bad)"
          : "var(--brand-700)";
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="muted text-[11px] uppercase tracking-wider font-semibold">
        {label}
      </div>
      <div className="mono mt-2" style={{ fontSize: 26, color, lineHeight: 1 }}>
        {value}
        {unit && (
          <span className="muted" style={{ fontSize: 13, marginLeft: 4 }}>
            {unit}
          </span>
        )}
      </div>
      {note && <div className="muted text-[11.5px] mt-2">{note}</div>}
    </div>
  );
}

export function Pill({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "bad" | "neutral";
  children: React.ReactNode;
}) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export function Dot({ hex }: { hex?: string | null }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 9,
        height: 9,
        borderRadius: 9,
        background: hex || "#ccc",
        marginRight: 7,
        verticalAlign: "middle",
        boxShadow: "0 0 0 2px #fff, 0 0 0 3px #e6e0f5",
      }}
    />
  );
}

export function inr(n: number | null | undefined) {
  if (n == null) return "—";
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

export function num(n: number | null | undefined, d = 2) {
  if (n == null) return "—";
  return Number(n).toFixed(d);
}
