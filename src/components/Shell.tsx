"use client";

import { usePathname } from "next/navigation";
import Nav from "@/components/Nav";

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path === "/login") return <>{children}</>;
  return (
    <>
      <Nav />
      <main className="max-w-[1500px] mx-auto px-6 py-6">{children}</main>
      <footer className="max-w-[1500px] mx-auto px-6 py-8 muted text-[11.5px]">
        Nandini DairyOps runs as a read-only overlay on the closed SCADA system —
        historian exports in; live verification captured independently at the
        checkweigher, the RFID portals and the QA bench. Built by Open Netrikkan.
      </footer>
    </>
  );
}
