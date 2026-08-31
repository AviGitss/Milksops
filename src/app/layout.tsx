import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Nandini DairyOps — Plant Assurance",
  description:
    "Fill volume control, dock verification, carton ledger and fat/SNF monitoring for the Nandini milk processing plant.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="max-w-[1400px] mx-auto px-6 py-6">{children}</main>
        <footer className="max-w-[1400px] mx-auto px-6 py-8 muted text-[11.5px]">
          Nandini DairyOps runs as a read-only overlay on the closed SCADA
          system — historian exports in, independent verification data captured
          at the checkweigher, dock gate and carton store.
        </footer>
      </body>
    </html>
  );
}
