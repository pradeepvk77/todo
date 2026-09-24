"use client";

import { useState, useEffect, useTransition } from "react";
import { Todo } from "@/lib/db";
import { editTodo } from "@/app/actions";
import { generate15MinTimeOptions, DAYS_OF_WEEK, formatAssignedDays } from "@/lib/time-utils";
import { Pencil, Loader2, Clock, FileText, Calendar, TrendingUp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TaskCategoryPicker } from "@/components/TaskCategoryPicker";

interface EditTaskDialogProps {
  todo: Todo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function parseInitialDays(assignedDay?: string): string[] {
  if (assignedDay === undefined || assignedDay === null) return ["everyday"];
  if (assignedDay.trim() === "") return [];
  if (assignedDay === "everyday") return ["everyday"];
  return assignedDay.split(",").map((d) => d.trim()).filter(Boolean);
}

export function EditTaskDialog({ todo, open, onOpenChange }: EditTaskDialogProps) {
  const [title, setTitle] = useState(todo.title);
  const [taskType, setTaskType] = useState<"time" | "input">(todo.task_type === "time" ? "time" : "input");
  const [selectedDays, setSelectedDays] = useState<string[]>(parseInitialDays(todo.assigned_day));
  const [initialValue, setInitialValue] = useState(todo.type_value);
  const [category, setCategory] = useState(todo.category || "Personal");
  const [excludeFromAnalytics, setExcludeFromAnalytics] = useState(Boolean(todo.exclude_from_analytics));
  const [trackProgress, setTrackProgress] = useState(Boolean(todo.track_progress));
  const [targetValue, setTargetValue] = useState<string>(
    todo.target_value !== null && todo.target_value !== undefined ? String(todo.target_value) : ""
  );
  const [unit, setUnit] = useState<string>(todo.unit || "");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setTitle(todo.title);
      setTaskType(todo.task_type === "time" ? "time" : "input");
      setSelectedDays(parseInitialDays(todo.assigned_day));
      setInitialValue(todo.type_value);
      setCategory(todo.category || "Personal");
      setExcludeFromAnalytics(Boolean(todo.exclude_from_analytics));
      setTrackProgress(Boolean(todo.track_progress));
      setTargetValue(todo.target_value !== null && todo.target_value !== undefined ? String(todo.target_value) : "");
      setUnit(todo.unit || "");
    }
  }, [open, todo]);

  const timeOptions = generate15MinTimeOptions();

  const handleTypeChange = (val: string | null) => {
    if (!val) return;
    const typeVal = val as "time" | "input";
    setTaskType(typeVal);
    if (typeVal === "time") {
      setInitialValue(timeOptions[0]);
    } else {
      setInitialValue("");
    }
  };

  const toggleDay = (dayVal: string) => {
    if (dayVal === "everyday") {
      if (isEveryday) {
        setSelectedDays([]);
      } else {
        setSelectedDays(["everyday"]);
      }
      return;
    }

    let current = selectedDays.filter((d) => d !== "everyday");
    if (current.includes(dayVal)) {
      current = current.filter((d) => d !== dayVal);
    } else {
      current.push(dayVal);
    }

    if (current.length === 7) {
      setSelectedDays(["everyday"]);
    } else {
      setSelectedDays(current);
    }
  };

  const isEveryday = selectedDays.includes("everyday") || selectedDays.length === 7;
  const hasNoDays = !isEveryday && selectedDays.length === 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isPending) return;

    const assignedDayValue = isEveryday
      ? "everyday"
      : hasNoDays
      ? ""
      : selectedDays.join(",");

    startTransition(async () => {
      await editTodo(todo.id, {
        title: title.trim(),
        task_type: taskType,
        type_value: initialValue || (taskType === "time" ? timeOptions[0] : ""),
        assigned_day: assignedDayValue,
        category,
        track_progress: trackProgress,
        target_value: trackProgress && targetValue !== "" ? Number(targetValue) : null,
        unit: trackProgress ? unit : null,
      });

      if (excludeFromAnalytics !== Boolean(todo.exclude_from_analytics)) {
        const { toggleTaskExcludeAnalytics } = await import("@/app/actions");
        await toggleTaskExcludeAnalytics(todo.id);
      }

      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 bg-card border-border text-card-foreground">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
            <Pencil className="w-5 h-5 text-primary" />
            Edit Task
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 my-2">
          {/* Task Name */}
          <div className="space-y-2">
            <Label htmlFor="edit-task-name" className="text-xs font-semibold text-foreground">
              Task Name
            </Label>
            <Input
              id="edit-task-name"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Wake up, Drink Water, Morning Journal"
              className="bg-background border-input text-foreground rounded-md"
              required
            />
          </div>

          <TaskCategoryPicker category={category} onChange={setCategory} />

          {/* Repeat Days (Alarm Style Multi-Select) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                Repeat Days
              </Label>
              <span className="text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {formatAssignedDays(isEveryday ? "everyday" : selectedDays.join(","))}
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <Button
                type="button"
                variant={isEveryday ? "default" : "outline"}
                size="sm"
                onClick={() => toggleDay("everyday")}
                className="text-xs h-7 px-2.5 rounded-md cursor-pointer"
              >
                Everyday
              </Button>

              {DAYS_OF_WEEK.map((d) => {
                const isSelected = !isEveryday && selectedDays.includes(d.value);
                return (
                  <Button
                    key={d.value}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleDay(d.value)}
                    className="text-xs h-7 px-2 rounded-md cursor-pointer font-medium"
                    title={d.label}
                  >
                    {d.short}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Task Type Selection */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground">Task Type</Label>
            <Select value={taskType} onValueChange={handleTypeChange}>
              <SelectTrigger className="w-full bg-background border-input text-foreground">
                <SelectValue placeholder="Select task type" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border text-popover-foreground">
                <SelectItem value="time">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    <span>Time Picker (15-min gap list)</span>
                  </div>
                </SelectItem>

                <SelectItem value="input">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <span>Notes</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Dynamic Component Preview */}
          {taskType === "time" && (
            <div className="space-y-2 bg-muted p-3 rounded-lg border border-border">
              <Label className="text-xs font-medium text-muted-foreground">
                Default Time:
              </Label>
              <Select
                value={initialValue || timeOptions[0]}
                onValueChange={(val) => setInitialValue(val || "")}
              >
                <SelectTrigger className="w-full text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-40 bg-popover border-border">
                  {timeOptions.map((t) => (
                    <SelectItem key={t} value={t} className="text-xs">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Track Progress Toggle */}
          <div className="space-y-3 p-3 rounded-lg border border-border bg-muted/40">
            <div className="flex items-center justify-between gap-2">
              <div>
                <Label htmlFor="track-progress" className="text-xs font-semibold text-foreground cursor-pointer flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" />
                  Track Progress & Completion Value
                </Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Ask for completed value (e.g. 50 pages, 30 mins) when marking task completed.
                </p>
              </div>
              <input
                id="track-progress"
                type="checkbox"
                checked={trackProgress}
                onChange={(e) => setTrackProgress(e.target.checked)}
                className="size-4 rounded-xs border-input text-primary focus:ring-primary cursor-pointer shrink-0"
              />
            </div>

            {trackProgress && (
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
                <div className="space-y-1">
                  <Label htmlFor="target-value" className="text-[11px] font-medium text-foreground">
                    Target Goal (Optional)
                  </Label>
                  <Input
                    id="target-value"
                    type="number"
                    step="any"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    placeholder="e.g. 50"
                    className="h-8 text-xs bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="progress-unit" className="text-[11px] font-medium text-foreground">
                    Unit / Label (Optional)
                  </Label>
                  <Input
                    id="progress-unit"
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="e.g. pages, mins"
                    className="h-8 text-xs bg-background"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Exclude from Analytics Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/40">
            <div>
              <Label htmlFor="exclude-analytics" className="text-xs font-semibold text-foreground block cursor-pointer">
                Exclude from Analytics
              </Label>
              <p className="text-[11px] text-muted-foreground">
                For routine tasks (e.g. Lunch, Dinner, Reach home) that shouldn&apos;t affect completion scores.
              </p>
            </div>
            <input
              id="exclude-analytics"
              type="checkbox"
              checked={excludeFromAnalytics}
              onChange={(e) => setExcludeFromAnalytics(e.target.checked)}
              className="size-4 rounded-xs border-input text-primary focus:ring-primary cursor-pointer"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !title.trim()}
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Update Task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
