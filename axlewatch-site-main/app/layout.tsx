import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AxleWatch — Monitoring heat. Protecting the fleet.",
  description: "Real‑time hub temperature and brake heat alerts for road‑trains.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
