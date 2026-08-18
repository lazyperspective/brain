import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BRAIN — Pradeep Kapoor",
  description:
    "A living brain built from the thoughts of everyone who has visited it. Add yours and watch it find a place.",
  authors: [{ name: "Pradeep Kapoor" }],
};

export const viewport: Viewport = {
  themeColor: "#05030e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
