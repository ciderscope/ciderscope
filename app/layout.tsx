import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
