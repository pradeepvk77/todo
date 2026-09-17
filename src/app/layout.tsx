import type { Metadata } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { OfflineBar } from "@/components/OfflineBar";

export const metadata: Metadata = {
  title: "Lets Do It",
  description: "Lets Do — a simple shared task planner.",
  icons: {
    icon: [{ url: "/image.png", type: "image/png", sizes: "512x512" }],
    shortcut: "/image.png",
    apple: "/image.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn("h-full antialiased font-sans")}>
      <head>
        {/* Preconnect to external APIs used by vocabulary generation.
            Opens the TCP + TLS connection early so the first fetch is faster. */}
        <link rel="preconnect" href="https://api.dictionaryapi.dev" />
        <link rel="preconnect" href="https://api.mymemory.translated.net" />
        {/* dns-prefetch as a fallback for browsers that don't support preconnect */}
        <link rel="dns-prefetch" href="https://api.dictionaryapi.dev" />
        <link rel="dns-prefetch" href="https://api.mymemory.translated.net" />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {/* Global offline indicator — appears on any page when device loses connection */}
        <OfflineBar />
        {children}
        {/* Registers the service worker for ALL users (caching + offline support) */}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
