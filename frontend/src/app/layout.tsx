import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";
import "@/lib/supabase/server-token";
import { AuthProvider } from "@/lib/auth";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "HRMS Post Offer Engagement",
  description:
    "Track offered candidates from acceptance to joining, reduce drop-off, and keep engagement warm.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable} h-full`}>
      <body className="min-h-full">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
