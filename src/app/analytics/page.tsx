import { getAnalytics } from "@/app/actions";
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/session";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const revalidate = 0;

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const analytics = await getAnalytics();

  return <main className="min-h-screen w-full max-w-3xl mx-auto px-4 py-10 sm:px-6"><header className="mb-7 flex items-start justify-between gap-4 border-b border-border pb-5"><div><h1 className="text-2xl font-bold tracking-tight">Analytics</h1><p className="mt-1 text-xs text-muted-foreground">A clear view of your task completion habits.</p></div><Link href="/"><Button variant="outline" size="sm" className="gap-2 cursor-pointer"><ArrowLeft className="size-3.5" />Dashboard</Button></Link></header><AnalyticsDashboard analytics={analytics} /></main>;
}
