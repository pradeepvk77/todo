import { CheckCircle2, Clock, ListTodo } from "lucide-react";
import { Todo } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface StatsCardProps {
  todos: Todo[];
}

export function StatsCard({ todos }: StatsCardProps) {
  const total = todos.length;
  const completed = todos.filter((t) => t.completed === 1).length;
  const active = total - completed;
  const completionPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      <Card className="glass-panel border-white/10 bg-slate-950/60 text-slate-100 shadow-xl">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
            <ListTodo className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Total Tasks</p>
            <p className="text-2xl font-bold text-slate-100">{total}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-panel border-white/10 bg-slate-950/60 text-slate-100 shadow-xl">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Pending</p>
            <p className="text-2xl font-bold text-slate-100">{active}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-panel border-white/10 bg-slate-950/60 text-slate-100 shadow-xl">
        <CardContent className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Completed</p>
                <p className="text-xl font-bold text-slate-100">{completed}</p>
              </div>
            </div>
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 font-bold">
              {completionPercentage}%
            </Badge>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-800/80 rounded-full h-2 mt-3 overflow-hidden border border-white/5">
            <div
              className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
