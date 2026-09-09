"use client";

import { useState, useTransition } from "react";
import { addTodo } from "@/app/actions";
import { generate15MinTimeOptions } from "@/lib/time-utils";
import { PlusCircle, Loader2, Clock, CheckSquare, FileText, Hash } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

export function AddTaskDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [taskType, setTaskType] = useState<"time" | "checkbox" | "input" | "number">("time");
  const [initialValue, setInitialValue] = useState("");
  const [isPending, startTransition] = useTransition();

  const timeOptions = generate15MinTimeOptions();

  const handleTypeChange = (val: string | null) => {
    if (!val) return;
    const typeVal = val as "time" | "checkbox" | "input" | "number";
    setTaskType(typeVal);
    if (typeVal === "time") {
      setInitialValue(timeOptions[0]);
    } else if (typeVal === "number") {
      setInitialValue("1");
    } else {
      setInitialValue("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isPending) return;

    startTransition(async () => {
      await addTodo({
        title: title.trim(),
        task_type: taskType,
        type_value: initialValue || (taskType === "time" ? timeOptions[0] : ""),
      });

      setTitle("");
      setTaskType("time");
      setInitialValue("");
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="font-medium px-4 py-2 flex items-center gap-2">
            <PlusCircle className="w-4 h-4" />
            <span>Add Task</span>
          </Button>
        }
      />

      <DialogContent className="max-w-md p-6 bg-card border-border text-card-foreground">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
            <PlusCircle className="w-5 h-5 text-primary" />
            Create New Task
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 my-2">
          {/* Task Name */}
          <div className="space-y-2">
            <Label htmlFor="task-name" className="text-xs font-semibold text-foreground">
              Task Name
            </Label>
            <Input
              id="task-name"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Wake up, Drink Water, Morning Journal"
              className="bg-background border-input text-foreground rounded-md"
              required
            />
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

                <SelectItem value="number">
                  <div className="flex items-center gap-2">
                    <Hash className="w-4 h-4 text-amber-500" />
                    <span>Number Counter (with + / - buttons)</span>
                  </div>
                </SelectItem>

                <SelectItem value="input">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <span>Text Note Input</span>
                  </div>
                </SelectItem>

                <SelectItem value="checkbox">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-emerald-500" />
                    <span>Simple Checkbox</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Dynamic Component Preview */}
          {taskType === "time" && (
            <div className="space-y-2 bg-muted p-3 rounded-lg border border-border">
              <Label className="text-xs font-medium text-muted-foreground">
                Default Time (starting from current time):
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

          {taskType === "number" && (
            <div className="space-y-2 bg-muted p-3 rounded-lg border border-border">
              <Label className="text-xs font-medium text-muted-foreground">Initial Count Value:</Label>
              <Input
                type="number"
                min="0"
                value={initialValue || "1"}
                onChange={(e) => setInitialValue(e.target.value)}
                className="text-xs bg-background"
              />
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !title.trim()}
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
