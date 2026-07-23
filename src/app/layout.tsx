import type { Metadata } from "next";
import { Inter, Schibsted_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { Providers } from "@/components/providers";
import { isClerkConfigured } from "@/lib/env";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const display = Schibsted_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "VoiceSheets — Spreadsheets at the speed of speech",
  description:
    "Create, organize, and populate spreadsheets with manual entry or AI-powered voice dictation.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const clerkEnabled = isClerkConfigured();

  const tree = (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${display.variable} font-sans antialiased`}>
        <Providers clerkEnabled={clerkEnabled}>{children}</Providers>
      </body>
    </html>
  );

  // Only mount ClerkProvider when Clerk is configured; otherwise the app runs
  // in single-user dev-auth mode without needing any Clerk keys.
  return clerkEnabled ? <ClerkProvider>{tree}</ClerkProvider> : tree;
}
