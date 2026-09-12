import { getTaskHistory } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getISTDateString } from "@/lib/time-utils";
import { CalendarDays, CheckCircle2, Circle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export const revalidate = 0;

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { date: requestedDate } = await searchParams;
  const date = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : getISTDateString();
  const { tasks, completed } = await getTaskHistory(date);
  const formattedDate = new Intl.DateTimeFormat("en-IN", { dateStyle: "full", timeZone: "Asia/Kolkata" }).format(new Date(`${date}T12:00:00+05:30`));

  return <main className="min-h-screen w-full max-w-xl mx-auto px-4 py-10 sm:px-6"><header className="mb-7 flex items-start justify-between gap-4 border-b border-border pb-5"><div><h1 className="text-2xl font-bold tracking-tight">Task history</h1><p className="mt-1 text-xs text-muted-foreground">Review your scheduled tasks from any day.</p></div><Link href="/"><Button variant="outline" size="sm" className="gap-2 cursor-pointer"><ArrowLeft className="size-3.5" />Dashboard</Button></Link></header><form className="mb-5 flex items-end gap-2"><label className="flex-1 text-xs font-medium">Choose a date<input name="date" type="date" defaultValue={date} max={getISTDateString()} className="mt-1 block h-9 w-full rounded-lg border border-input bg-background px-3 text-sm" /></label><Button type="submit" className="gap-2 cursor-pointer"><CalendarDays className="size-4" />View</Button></form><Card className="mb-4 rounded-xl border border-border shadow-xs"><CardContent className="flex items-center justify-between gap-4 p-4"><div><p className="text-sm font-semibold">{formattedDate}</p><p className="mt-0.5 text-xs text-muted-foreground">Completion for scheduled tasks</p></div><div className="rounded-lg bg-primary px-3 py-2 text-center text-primary-foreground"><p className="text-lg font-bold leading-none">{completed}/{tasks.length}</p><p className="mt-1 text-[10px]">completed</p></div></CardContent></Card><section className="space-y-2.5">{tasks.length ? tasks.map((task) => <Card key={task.id} className="rounded-xl border border-border shadow-xs"><CardContent className="flex items-center gap-3 p-3.5">{task.completed ? <CheckCircle2 className="size-5 shrink-0 text-emerald-600" /> : <Circle className="size-5 shrink-0 text-muted-foreground" />}<span className={`text-sm font-semibold ${task.completed ? "text-muted-foreground line-through" : "text-foreground"}`}>{task.title}</span><span className={`ml-auto text-[10px] font-medium ${task.completed ? "text-emerald-600" : "text-muted-foreground"}`}>{task.completed ? "Completed" : "Incomplete"}</span></CardContent></Card>) : <Card className="rounded-xl border border-border"><CardContent className="p-8 text-center text-sm text-muted-foreground">No tasks were scheduled for this date.</CardContent></Card>}</section></main>;
}
