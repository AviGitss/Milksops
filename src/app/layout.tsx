import type { Metadata } from "next";
import "./globals.css";
import Shell from "@/components/Shell";

export const metadata: Metadata = {
  title: "Nandini DairyOps — Plant Assurance",
  description:
    "Fill volume control, dock verification, carton RFID reconciliation and fat/SNF monitoring for the Nandini milk processing plant. Built by Open Netrikkan.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
