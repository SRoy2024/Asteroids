import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Asteroids — Neon Sector",
  description: "A neon multiplayer trail arena, offline bot practice, and classic Asteroids. Built by Soham Roy.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
