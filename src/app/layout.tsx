import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/lib/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Defaults applied to every page that doesn't generate its own metadata.
// Public booking and profile pages override these via generateMetadata().
export const metadata: Metadata = {
  metadataBase: process.env.NEXT_PUBLIC_APP_URL
    ? new URL(process.env.NEXT_PUBLIC_APP_URL)
    : undefined,
  title: {
    default: "ScheduleFlow - Modern Scheduling Platform",
    template: "%s · ScheduleFlow",
  },
  description: "A modern scheduling platform for professionals and teams",
  openGraph: {
    title: "ScheduleFlow - Modern Scheduling Platform",
    description:
      "A modern scheduling platform for professionals and teams",
    siteName: "ScheduleFlow",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ScheduleFlow - Modern Scheduling Platform",
    description:
      "A modern scheduling platform for professionals and teams",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
