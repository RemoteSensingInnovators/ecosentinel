import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const sans = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "EcoSentinel — Qashqadaryo ekologik monitoring",
  description: "Google Earth Engine asosida Qashqadaryo viloyatining 2019–2026 yillardagi atmosfera, yer qoplami, suv va issiqlik monitoringi: NO₂, SO₂, CO, HCHO, aerozol, NDVI, NDMI, NDSI, MNDWI, LST, yog‘in, Dynamic World.",
};
export const viewport: Viewport = { themeColor: "#0b1117", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
