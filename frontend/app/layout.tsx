import "./globals.css";
import "leaflet/dist/leaflet.css";
import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import React from "react";

export const metadata: Metadata = {
  title: "GeoEstate Bucuresti",
  description: "Aplicatie GIS pentru analiza economica imobiliara in Bucuresti",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
