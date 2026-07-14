import type { Metadata } from "next";
import { Archivo, Space_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Backlog — the honest ledger of everything you've built",
  description:
    "Every project you've started, scored by AI from your git history and Claude Code sessions, and written onchain to Monad. What's done, what's left, what's dead.",
  openGraph: {
    title: "Backlog — every project you've started, proven onchain",
    description:
      "An AI reads your repos and AI-coding sessions, scores each project's completion, and anchors your builder track record onchain to Monad.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${archivo.variable} ${spaceMono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
