import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Asteroids — Orbital Arcade",
  description: "A little ship. An endless sky. Play Soham Roy’s Asteroids and compete on the global leaderboard.",
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
