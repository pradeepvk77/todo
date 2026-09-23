"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  Lock,
  RotateCcw,
  Target,
  X,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import {
  HistoryDaySummary,
  DayTaskItem,
  getDayHistoryDetails,
  saveDayHistory,
  TaskHistoryUpdateItem,
} from "@/app/actions/history";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface HistoryPageClientProps {
  initialSummaries: HistoryDaySummary[];
  otherUser?: boolean;
  otherUserName?: string;
}

interface TaskFormState {
  status: DayTaskItem["status"];
  completedValue: string; // string input to preserve decimal typing
  completedAtTime: string;
}

export function HistoryPageClient({
  initialSummaries,
  otherUser = false,
  otherUserName = "User",
}: HistoryPageClientProps) {
  const [summaries, setSummaries] = useState<HistoryDaySummary[]>(initialSummaries);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayDetails, setDayDetails] = useState<{
    date: string;
    formattedDate: string;
    isEditable: boolean;
    tasks: DayTaskItem[];
  } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Form updates indexed by todoId
  const [formState, setFormState] = useState<Record<number, TaskFormState>>({});
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const openDayForm = async (dateStr: string) => {
    setSelectedDate(dateStr);
    setLoadingDetails(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const details = await getDayHistoryDetails(dateStr, otherUser ? "other" : undefined);
      setDayDetails(details);

      // Initialize form state
      const initialForm: Record<number, TaskFormState> = {};
      details.tasks.forEach((t) => {
        let timeStr = "";
        if (t.completedAt) {
          try {
            const d = new Date(t.completedAt);
            timeStr = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
          } catch {
            timeStr = "";
          }
        }
        initialForm[t.todoId] = {
          status: t.status,
          // CRITICAL: Empty by default if value is null! Never pre-fill with targetValue.
          completedValue: t.completedValue !== null ? String(t.completedValue) : "",
          completedAtTime: timeStr,
        };
      });
      setFormState(initialForm);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load day details.");
    } finally {
      setLoadingDetails(false);
    }
  };

  const closeForm = () => {
    setSelectedDate(null);
    setDayDetails(null);
    setFormState({});
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleTaskStatusChange = (todoId: number, newStatus: DayTaskItem["status"]) => {
    setFormState((prev) => ({
      ...prev,
      [todoId]: {
        ...prev[todoId],
        status: newStatus,
      },
    }));
    setErrorMsg(null);
  };

  const handleTaskValueChange = (todoId: number, val: string) => {
    setFormState((prev) => ({
      ...prev,
      [todoId]: {
        ...prev[todoId],
        completedValue: val,
      },
    }));
    setErrorMsg(null);
  };

  const handleTaskTimeChange = (todoId: number, timeVal: string) => {
    setFormState((prev) => ({
      ...prev,
      [todoId]: {
        ...prev[todoId],
        completedAtTime: timeVal,
      },
    }));
    setErrorMsg(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dayDetails || !dayDetails.isEditable) return;

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const updates: TaskHistoryUpdateItem[] = [];

      for (const task of dayDetails.tasks) {
        const state = formState[task.todoId];
        if (!state) continue;

        let numVal: number | null = null;
        if (state.completedValue.trim() !== "") {
          const parsed = parseFloat(state.completedValue.trim());
          if (isNaN(parsed) || !isFinite(parsed)) {
            throw new Error(`Invalid numeric value for "${task.title}". Must be a valid number.`);
          }
          if (parsed < 0) {
            throw new Error(`Negative value for "${task.title}" is not allowed.`);
          }
          numVal = parsed;
        }

        const validStatus: TaskHistoryUpdateItem["status"] =
          state.status === "pending" ? "no_action" : state.status;

        updates.push({
          todoId: task.todoId,
          status: validStatus,
          completedValue: numVal,
          completedAtTime: state.completedAtTime.trim() || null,
        });
      }

      const res = await saveDayHistory(dayDetails.date, updates);
      if (!res.success) {
        throw new Error(res.error || "Failed to save history.");
      }

      setSuccessMsg("Day history updated successfully!");

      // Update summary table state locally
      const updatedDetails = await getDayHistoryDetails(dayDetails.date, otherUser ? "other" : undefined);
      setDayDetails(updatedDetails);

      // Refresh total summaries
      setSummaries((prev) =>
        prev.map((s) => {
          if (s.date === dayDetails.date) {
            const completedCount = updatedDetails.tasks.filter((t) => t.status === "completed").length;
            const missingCount = updatedDetails.tasks.filter(
              (t) =>
                t.status === "completed" &&
                (t.taskType === "input" || t.taskType === "number") &&
                t.completedValue === null
            ).length;

            return {
              ...s,
              completedTasks: completedCount,
              missingDetails: missingCount,
            };
          }
          return s;
        })
      );
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred while saving.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen w-full max-w-3xl mx-auto px-4 py-8 sm:px-6">
      {/* HEADER */}
      <header className="mb-6 flex items-start justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>{otherUser ? `${otherUserName}'s Complete History` : "Complete History"}</span>
          </h1>
          <p className="mt-1 text-xs text-muted-foreground font-medium">
            Review your recent task history and fill in missing details.
          </p>
        </div>
        <Link href={otherUser ? "/?user=other" : "/"}>
          <Button variant="outline" size="sm" className="gap-2 cursor-pointer rounded-xl text-xs font-semibold">
            <ArrowLeft className="size-3.5" />
            Dashboard
          </Button>
        </Link>
      </header>

      {/* HISTORY TABLE */}
      <Card className="rounded-2xl border border-border shadow-xs overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b border-border text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-center">Tasks</th>
                  <th className="py-3 px-4 text-center">Completed</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {summaries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                      No task history records found.
                    </td>
                  </tr>
                ) : (
                  summaries.map((item) => (
                    <tr key={item.date} className="hover:bg-muted/30 transition-colors">
                      {/* Date */}
                      <td className="py-3.5 px-4 font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="size-4 text-muted-foreground shrink-0" />
                          <span>{item.formattedDate}</span>
                        </div>
                      </td>

                      {/* Tasks */}
                      <td className="py-3.5 px-4 text-center font-medium text-foreground">
                        {item.totalTasks}
                      </td>

                      {/* Completed */}
                      <td className="py-3.5 px-4 text-center font-medium text-foreground">
                        {item.completedTasks}
                      </td>

                      {/* Missing / Status Badge */}
                      <td className="py-3.5 px-4 text-center">
                        {item.missingDetails > 0 ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <span>🟡</span>
                            <span>{item.missingDetails} missing</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <span>✓</span>
                            <span>All data recorded</span>
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right">
                        {item.isEditable ? (
                          <Button
                            size="sm"
                            variant={item.missingDetails > 0 ? "default" : "outline"}
                            onClick={() => openDayForm(item.date)}
                            className="gap-1.5 cursor-pointer rounded-xl text-xs font-bold px-3 py-1.5"
                          >
                            <Edit3 className="size-3.5" />
                            <span>Edit</span>
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openDayForm(item.date)}
                            className="gap-1.5 cursor-pointer rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground px-3 py-1.5"
                          >
                            <Lock className="size-3.5" />
                            <span>Read only</span>
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* DAY-LEVEL EDIT FORM DIALOG */}
      <Dialog open={selectedDate !== null} onOpenChange={(open) => !open && closeForm()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-card border border-border p-6 shadow-xl space-y-5">
          <DialogHeader className="space-y-1.5 text-left border-b border-border pb-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                <Calendar className="size-5 text-emerald-500" />
                <span>{dayDetails?.formattedDate || "Task Details"}</span>
              </DialogTitle>

              {dayDetails && !dayDetails.isEditable && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
                  <Lock className="size-3" />
                  Read only (Older than 5 days)
                </span>
              )}
            </div>
            <DialogDescription className="text-xs text-muted-foreground font-medium">
              {dayDetails?.isEditable
                ? "Review tasks for this date and fill in missing quantitative or completion values."
                : "Historical task record (read-only mode)."}
            </DialogDescription>
          </DialogHeader>

          {loadingDetails ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              Loading day history details...
            </div>
          ) : dayDetails ? (
            <form onSubmit={handleSave} className="space-y-6">
              {/* FEEDBACK MESSAGES */}
              {errorMsg && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-600 dark:text-rose-400">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* TASKS LIST */}
              <div className="space-y-4">
                {dayDetails.tasks.map((task) => {
                  const state = formState[task.todoId] || {
                    status: task.status,
                    completedValue: "",
                    completedAtTime: "",
                  };
                  const isMeasurable = task.taskType === "input" || task.taskType === "number";
                  const isTimeTask = task.taskType === "time";
                  const isCompleted = state.status === "completed";

                  return (
                    <div
                      key={task.todoId}
                      className={`p-4 rounded-xl border transition-all ${
                        isCompleted
                          ? "bg-muted/20 border-border"
                          : "bg-background border-border/80"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <h4 className="text-sm font-bold text-foreground">{task.title}</h4>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground font-medium">
                            <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-semibold">
                              {task.category}
                            </span>
                            {task.scheduledTime && <span>• Scheduled: {task.scheduledTime}</span>}
                          </div>
                        </div>

                        {/* STATUS SELECTOR */}
                        <div className="flex items-center gap-1.5">
                          {dayDetails.isEditable ? (
                            <select
                              value={state.status}
                              onChange={(e) =>
                                handleTaskStatusChange(task.todoId, e.target.value as DayTaskItem["status"])
                              }
                              className="h-8 px-2.5 rounded-lg border border-input bg-background text-xs font-semibold text-foreground shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                            >
                              <option value="completed">✓ Completed</option>
                              <option value="no_action">No Action</option>
                              <option value="skipped font-medium">Skipped</option>
                            </select>
                          ) : (
                            <span
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                                isCompleted
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {state.status === "completed" ? "✓ Completed" : state.status}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* TASK SPECIFIC FIELDS */}
                      {isCompleted && (
                        <div className="mt-3 pt-3 border-t border-border/60 space-y-2.5">
                          {/* MEASURABLE TASK (Input / Number) */}
                          {isMeasurable && (
                            <div className="space-y-2">
                              {/* TARGET BADGE */}
                              {task.targetValue !== null && (
                                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg w-fit">
                                  <Target className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                                  <span>Target:</span>
                                  <span className="font-extrabold">
                                    {task.targetValue} {task.unit}
                                  </span>
                                </div>
                              )}

                              {/* ACTUAL VALUE FIELD */}
                              {task.isRecorded && !dayDetails.isEditable ? (
                                <div className="text-xs font-bold text-foreground bg-muted/50 px-3 py-2 rounded-lg border border-border flex items-center justify-between">
                                  <span>Actual Recorded Value:</span>
                                  <span className="text-emerald-600 font-extrabold">
                                    {task.completedValue} {task.unit}
                                  </span>
                                </div>
                              ) : dayDetails.isEditable ? (
                                <div className="space-y-1">
                                  <label className="text-xs font-bold text-foreground block">
                                    Actual {task.unit || "value"}:
                                  </label>
                                  <div className="relative flex items-center max-w-xs">
                                    <input
                                      type="number"
                                      step="any"
                                      min="0"
                                      value={state.completedValue}
                                      onChange={(e) => handleTaskValueChange(task.todoId, e.target.value)}
                                      placeholder={
                                        task.targetValue !== null
                                          ? `e.g. ${task.targetValue}`
                                          : "Enter actual value"
                                      }
                                      className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-bold text-foreground shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                    />
                                    {task.unit && (
                                      <span className="absolute right-3 text-xs font-bold text-muted-foreground">
                                        {task.unit}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          )}

                          {/* TIME TASK */}
                          {isTimeTask && (
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-foreground block">
                                Completed at time:
                              </label>
                              {dayDetails.isEditable ? (
                                <input
                                  type="text"
                                  placeholder="e.g. 05:20 PM"
                                  value={state.completedAtTime}
                                  onChange={(e) => handleTaskTimeChange(task.todoId, e.target.value)}
                                  className="w-48 px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-semibold text-foreground shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                />
                              ) : (
                                <p className="text-xs font-semibold text-muted-foreground">
                                  {state.completedAtTime || "Recorded"}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* MODAL ACTIONS */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeForm}
                  className="rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Close
                </Button>

                {dayDetails.isEditable && (
                  <Button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer px-5"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                )}
              </div>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}
