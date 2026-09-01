"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const links = [
  { href: "/", label: "Command Centre" },
  { href: "/fill", label: "Fill Control" },
  { href: "/dock", label: "Dock Verification" },
  { href: "/cartons", label: "Carton Ledger" },
  { href: "/rfid", label: "RFID" },
  { href: "/quality", label: "Fat / SNF" },
  { href: "/scada", label: "SCADA" },
  { href: "/uploads", label: "Data Uploads" },
  { href: "/settings", label: "Settings" },
  { href: "/integrations", label: "APIs" },
  { href: "/alerts", label: "Alerts" },
];

function Logo() {
  return (
    <span
      className="inline-flex items-center rounded-lg px-2 py-1.5"
      style={{ background: "#fff" }}
    >
      <Image
        src="/opennetrikkan.png"
        alt="Open Netrikkan"
        width={168}
        height={42}
        priority
        style={{ height: 20, width: "auto" }}
      />
    </span>
  );
}

export default function Nav() {
  const path = usePathname();
  const router = useRouter();
  const [who, setWho] = useState("");

  useEffect(() => {
    const m = document.cookie.match(/dairyops_user=([^;]+)/);
    setWho(m ? decodeURIComponent(m[1]) : "");
  }, []);

  function signOut() {
    document.cookie = "dairyops_user=; path=/; max-age=0";
    router.push("/login");
  }

  return (
    <header
      style={{
        background: "linear-gradient(100deg,#2d1b69 0%,#4a2fa0 60%,#7b5fc4 100%)",
        color: "#fff",
      }}
    >
      <div className="max-w-[1500px] mx-auto px-6 pt-3 pb-0">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Link href="/" aria-label="Open Netrikkan home">
              <Logo />
            </Link>
            <span
              style={{
                width: 1,
                height: 22,
                background: "rgba(255,255,255,.28)",
                display: "inline-block",
              }}
            />
            <span style={{ fontFamily: "Georgia, serif", fontSize: 18 }}>
              Nandini <span style={{ color: "#f0c040" }}>DairyOps</span>
            </span>
            <span
              className="text-[11px] uppercase tracking-widest hidden md:inline"
              style={{ color: "#c8b5f5" }}
            >
              KMF Mega Dairy · Bengaluru
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11.5px]" style={{ color: "#c8b5f5" }}>
            {who && <span>Signed in as {who}</span>}
            <button
              onClick={signOut}
              style={{
                border: "1px solid rgba(255,255,255,.32)",
                borderRadius: 8,
                padding: "3px 10px",
                color: "#fff",
              }}
            >
              Sign out
            </button>
          </div>
        </div>
        <nav className="flex gap-1 mt-3 overflow-x-auto">
          {links.map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                style={{
                  padding: "8px 13px",
                  borderRadius: "10px 10px 0 0",
                  fontSize: 12.5,
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
