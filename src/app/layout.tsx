import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 antialiased">
        {children}
      </body>
    </html>
  );
}
