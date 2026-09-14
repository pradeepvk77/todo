"use client";

import { useState, useTransition } from "react";
import { Todo } from "@/lib/db";
import { updateTaskValue } from "@/app/actions";
import { generate15MinTimeOptions } from "@/lib/time-utils";
import { Plus, Minus, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TaskWidgetProps {
  todo: Todo;
  isCompleted: boolean;
  readOnly?: boolean;
}

export function TaskWidget({ todo, isCompleted, readOnly = false }: TaskWidgetProps) {
  const [isPending, startTransition] = useTransition();
  const [val, setVal] = useState(todo.type_value);

  // Time options list (15 min gap starting from current time)
  const timeOptions = generate15MinTimeOptions();

  const handleValueChange = (newValue: string | null) => {
    if (readOnly) return;
    const valueToSave = newValue || "";
    setVal(valueToSave);
    startTransition(async () => {
      await updateTaskValue(todo.id, valueToSave);
    });
  };

  if (todo.task_type === "time") {
    const defaultTime = val || timeOptions[0];

    return (
      <div className="flex items-center gap-1.5">
        <Select value={defaultTime} onValueChange={handleValueChange} disabled={readOnly || isPending || isCompleted}>
          <SelectTrigger className="h-7 w-28 sm:w-32 text-xs font-medium border-border/80 bg-background text-foreground rounded-lg disabled:opacity-60 disabled:cursor-not-allowed px-2.5">
            <Clock className="w-3 h-3 mr-1 text-muted-foreground shrink-0" />
            <SelectValue placeholder="Select Time" />
          </SelectTrigger>
          <SelectContent className="max-h-48 bg-popover border-border text-popover-foreground">
            {timeOptions.map((timeStr) => (
              <SelectItem key={timeStr} value={timeStr} className="text-xs">
                {timeStr}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (todo.task_type === "number") {
    const num = parseInt(val || "0", 10);

    const handleDecrement = () => {
      if (readOnly) return;
      const next = Math.max(0, num - 1);
      handleValueChange(String(next));
    };

    const handleIncrement = () => {
      if (readOnly) return;
      const next = num + 1;
      handleValueChange(String(next));
    };

    return (
      <div className="flex items-center gap-0.5 bg-muted/70 p-0.5 rounded-lg border border-border/70">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleDecrement}
          disabled={readOnly || isPending || isCompleted || num <= 0}
          className="h-5 w-5 rounded text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Minus className="w-3 h-3" />
        </Button>
        <span className="px-1.5 text-xs font-bold text-foreground min-w-[1.25rem] text-center">
          {num}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleIncrement}
          disabled={readOnly || isPending || isCompleted}
          className="h-5 w-5 rounded text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  if (todo.task_type === "input") {
    return (
      <div className="flex items-center gap-2 max-w-28 sm:max-w-32">
        <Input
          type="text"
          value={val}
          onChange={(e) => !readOnly && setVal(e.target.value)}
          onBlur={() => !readOnly && handleValueChange(val)}
          placeholder="Note..."
          disabled={readOnly || isCompleted}
          readOnly={readOnly}
          className="h-7 text-xs bg-background border-input text-foreground rounded-lg disabled:opacity-60 disabled:cursor-not-allowed px-2.5"
        />
      </div>
    );
  }

  // Checkbox type default fallback - clean subtle label if needed
  return null;
}

