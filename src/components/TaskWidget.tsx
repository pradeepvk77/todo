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
import { Badge } from "@/components/ui/badge";

interface TaskWidgetProps {
  todo: Todo;
  isCompleted: boolean;
}

export function TaskWidget({ todo, isCompleted }: TaskWidgetProps) {
  const [isPending, startTransition] = useTransition();
  const [val, setVal] = useState(todo.type_value);

  // Time options list (15 min gap starting from current time)
  const timeOptions = generate15MinTimeOptions();

  const handleValueChange = (newValue: string | null) => {
    const valueToSave = newValue || "";
    setVal(valueToSave);
    startTransition(async () => {
      await updateTaskValue(todo.id, valueToSave);
    });
  };

  if (todo.task_type === "time") {
    const defaultTime = val || timeOptions[0];

    return (
      <div className="flex items-center gap-2">
        <Select value={defaultTime} onValueChange={handleValueChange} disabled={isPending || isCompleted}>
          <SelectTrigger className="h-8 w-32 text-xs font-medium border-border bg-background text-foreground rounded-md">
            <Clock className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
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
      const next = Math.max(0, num - 1);
      handleValueChange(String(next));
    };

    const handleIncrement = () => {
      const next = num + 1;
      handleValueChange(String(next));
    };

    return (
      <div className="flex items-center gap-1 bg-muted p-0.5 rounded-md border border-border">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleDecrement}
          disabled={isPending || isCompleted || num <= 0}
          className="h-6 w-6 rounded text-muted-foreground hover:text-foreground"
        >
          <Minus className="w-3 h-3" />
        </Button>
        <span className="px-2 text-xs font-bold text-foreground min-w-[1.5rem] text-center">
          {num}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleIncrement}
          disabled={isPending || isCompleted}
          className="h-6 w-6 rounded text-muted-foreground hover:text-foreground"
        >
          <Plus className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  if (todo.task_type === "input") {
    return (
      <div className="flex items-center gap-2 max-w-[160px] sm:max-w-[200px]">
        <Input
          type="text"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={() => handleValueChange(val)}
          placeholder="Note..."
          disabled={isCompleted}
          className="h-8 text-xs bg-background border-input text-foreground rounded-md"
        />
      </div>
    );
  }

  // Checkbox type default fallback badge
  return (
    <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
      Task
    </Badge>
  );
}
