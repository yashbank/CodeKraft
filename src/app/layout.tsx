import type { Metadata } from "next";
import { fontVariables } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "CodeKraft",
  description: "Premium software studio and digital-product marketplace.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark-cinematic" className={fontVariables} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
