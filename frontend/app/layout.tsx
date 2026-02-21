import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PingPoint",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background">{children}</body>
    </html>
  );
}
