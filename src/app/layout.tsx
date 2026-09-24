import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CodeKraft",
  description: "Premium software studio and digital-product marketplace.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark-cinematic" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
