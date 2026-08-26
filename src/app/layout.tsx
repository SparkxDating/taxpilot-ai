import type { Metadata } from "next";
import { Source_Serif_4 } from "next/font/google";
import "./globals.css";

const serif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source",
});

export const metadata: Metadata = {
  title: {
    default: "TaxPilot AI",
    template: "%s · TaxPilot AI",
  },
  description: "Guided ITR-3 and ITR-4 preparation for AY 2026–27. Independent software, not affiliated with the Income Tax Department.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
