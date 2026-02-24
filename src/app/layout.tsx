import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Deep-Tech Pulse",
  description:
    "Fully automated AI news dashboard for agentic coding teams. Stay current in 30 seconds.",
  openGraph: {
    title: "Deep-Tech Pulse",
    description:
      "Fully automated AI news dashboard for agentic coding teams.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-surface-0 text-gray-100 antialiased font-[family-name:var(--font-inter)]">
        {children}
      </body>
    </html>
  );
}
