"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Command Centre" },
  { href: "/fill", label: "Fill Control" },
  { href: "/dock", label: "Dock Verification" },
  { href: "/cartons", label: "Carton Ledger" },
  { href: "/quality", label: "Fat / SNF Monitor" },
  { href: "/scada", label: "SCADA Bridge" },
  { href: "/alerts", label: "Alerts" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <header
      style={{
        background: "linear-gradient(100deg,#2d1b69 0%,#4a2fa0 60%,#7b5fc4 100%)",
        color: "#fff",
      }}
    >
      <div className="max-w-[1400px] mx-auto px-6 pt-4 pb-0">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-baseline gap-3">
            <span
              style={{
                fontFamily: "Georgia, serif",
                fontSize: 19,
                letterSpacing: "-0.01em",
              }}
            >
              Nandini <span style={{ color: "#f0c040" }}>DairyOps</span>
            </span>
            <span
              className="text-[11px] uppercase tracking-widest"
              style={{ color: "#c8b5f5" }}
            >
              KMF Mega Dairy · Bengaluru
            </span>
          </div>
          <span className="text-[11px]" style={{ color: "#c8b5f5" }}>
            Independent assurance layer · SCADA-agnostic
          </span>
        </div>
        <nav className="flex gap-1 mt-4 overflow-x-auto">
          {links.map((l) => {
            const active =
              l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                style={{
                  padding: "9px 14px",
                  borderRadius: "10px 10px 0 0",
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  whiteSpace: "nowrap",
                  background: active ? "#f6f4fb" : "transparent",
                  color: active ? "#2d1b69" : "#e2d9f8",
                }}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
