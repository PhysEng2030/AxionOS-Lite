import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AXION Lite",
  description: "Web and engineering design assistant for KiCad, Fusion 360, and Arduino.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
