import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "./AppProviders";

export const metadata: Metadata = {
  title: "CiderScope — IFPC",
  description: "Plateforme d'analyse sensorielle IFPC",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="antialiased">
      <body className="min-h-screen">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
