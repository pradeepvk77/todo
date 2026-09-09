import type { Metadata } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "TaskFlow | Next.js SQLite Todo App",
  description: "A fast, lightweight, modern Todo application built with Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, and embedded SQLite.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn("h-full antialiased font-sans")}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
