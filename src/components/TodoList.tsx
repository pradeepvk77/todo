"use client";

import { useState, useTransition } from "react";
import { Todo, DaySection } from "@/lib/db";
import { toggleTodo, updateTaskSectionAndOrder, updateTaskOrder } from "@/app/actions";
import { TaskWidget } from "@/components/TaskWidget";
import { formatAssignedDays } from "@/lib/time-utils";
import { GripVertical, CheckSquare, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { TaskFilter, TaskFilters } from "@/components/TaskFilters";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";

interface TodoListProps {
  initialTodos: Todo[];
}

const SECTIONS: { key: DaySection; label: string; icon: string }[] = [
  { key: "MORNING", label: "Morning", icon: "🌅" },
  { key: "AFTERNOON", label: "Afternoon", icon: "☀️" },
  { key: "EVENING", label: "Evening", icon: "🌆" },
  { key: "NIGHT", label: "Night", icon: "🌙" },
];

export function TodoList({ initialTodos }: TodoListProps) {
  const [todos, setTodos] = useState<Todo[]>(initialTodos);
  const [prevInitialTodos, setPrevInitialTodos] = useState<Todo[]>(initialTodos);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [, startTransition] = useTransition();

  if (initialTodos !== prevInitialTodos) {
    setPrevInitialTodos(initialTodos);
    setTodos(initialTodos);
  }

  const handleToggle = (id: number, currentCompleted: boolean) => {
    setTogglingId(id);
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !currentCompleted } : t))
    );
    startTransition(async () => {
      try {
        await toggleTodo(id, currentCompleted);
      } finally {
        setTogglingId(null);
      }
    });
  };

  const handleDragEnd = (result: DropResult) => {
    if (filter !== "all") return;
    const { destination, source, draggableId } = result;
    if (!destination) return;

    const sourceSection = source.droppableId as DaySection;
    const destSection = destination.droppableId as DaySection;
    const destIndex = destination.index;
    const taskId = parseInt(draggableId, 10);

    if (sourceSection === destSection && source.index === destIndex) {
      return;
    }

    setTodos((prevTodos) => {
      const updatedTodos = prevTodos.map((t) =>
        t.id === taskId ? { ...t, day_section: destSection } : t
      );

      const groups: Record<DaySection, Todo[]> = {
        MORNING: [],
        AFTERNOON: [],
        EVENING: [],
        NIGHT: [],
      };

      updatedTodos.forEach((t) => {
        const sec = t.day_section && groups[t.day_section] ? t.day_section : "MORNING";
        groups[sec].push(t);
      });

      const destList = Array.from(groups[destSection]);
      const movedItemIndex = destList.findIndex((t) => t.id === taskId);
      if (movedItemIndex !== -1) {
        const [movedItem] = destList.splice(movedItemIndex, 1);
        destList.splice(destIndex, 0, movedItem);
        groups[destSection] = destList;
      }

      const newOrderedTodos = SECTIONS.flatMap((sec) => groups[sec.key]);
      const orderedIds = newOrderedTodos.map((t) => t.id);

      startTransition(async () => {
        if (sourceSection !== destSection) {
          await updateTaskSectionAndOrder(taskId, destSection, orderedIds);
        } else {
          await updateTaskOrder(orderedIds);
        }
      });

      return newOrderedTodos;
    });
  };

  if (todos.length === 0) {
    return (
      <Card className="border border-border/80 bg-card p-6 text-center shadow-2xs rounded-xl">
        <CardContent className="space-y-2.5 p-0">
          <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center mx-auto text-muted-foreground border border-border/60">
            <CheckSquare className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-card-foreground">No tasks scheduled for today</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Click the <strong className="text-foreground font-medium">Edit tasks</strong> option in the menu above to add tasks.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const pendingCount = todos.filter((todo) => !todo.completed).length;
  const completedCount = todos.length - pendingCount;
  const visibleTodos = todos.filter((todo) => filter === "all" || (filter === "completed" ? todo.completed : !todo.completed));

  return (
    <div className="space-y-4">
      <TaskFilters value={filter} onChange={setFilter} total={todos.length} pending={pendingCount} completed={completedCount} />
      {visibleTodos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/70 px-4 py-6 text-center text-xs text-muted-foreground">
          No {filter} tasks for today.
        </p>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="space-y-4">
            {SECTIONS.map((sec) => {
              const sectionTodos = visibleTodos.filter(
                (t) => (t.day_section || "MORNING") === sec.key
              );

              return (
                <div key={sec.key} className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <span>{sec.icon}</span>
                      <span>{sec.label}</span>
                    </h3>
                    <span className="text-[11px] font-semibold text-muted-foreground/75 bg-muted/60 px-2 py-0.5 rounded-full border border-border/40">
                      {sectionTodos.length}
                    </span>
                  </div>

                  <Droppable droppableId={sec.key}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={[
                          "min-h-[44px] rounded-xl border transition-colors",
                          snapshot.isDraggingOver
                            ? "border-primary/50 bg-primary/5"
                            : "border-border/80 bg-card shadow-2xs",
                          sectionTodos.length > 0 ? "divide-y divide-border/60 overflow-hidden" : "p-3 text-center",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {sectionTodos.length === 0 ? (
                          <p className="text-xs text-muted-foreground/60 font-medium py-1">
                            No {sec.label.toLowerCase()} tasks — drag tasks here
                          </p>
                        ) : (
                          sectionTodos.map((todo, index) => {
                            const isCompleted = todo.completed;
                            const isToggling = togglingId === todo.id;

                            return (
                              <Draggable
                                key={todo.id.toString()}
                                draggableId={todo.id.toString()}
                                index={index}
                                isDragDisabled={filter !== "all"}
                              >
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    style={provided.draggableProps.style}
                                    className={[
                                      "px-3 py-2.5 sm:px-3.5 flex items-center justify-between gap-3 transition-colors",
                                      isCompleted
                                        ? "bg-muted/30"
                                        : "bg-card hover:bg-muted/20",
                                      snapshot.isDragging ? "shadow-md ring-1 ring-primary/20 bg-background" : "",
                                    ]
                                      .filter(Boolean)
                                      .join(" ")}
                                  >
                                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                      {filter === "all" && (
                                        <div
                                          {...provided.dragHandleProps}
                                          className="text-muted-foreground/50 hover:text-foreground cursor-grab active:cursor-grabbing p-0.5 rounded shrink-0"
                                          title="Drag to reorder or move section"
                                        >
                                          <GripVertical className="w-4 h-4" />
                                        </div>
                                      )}

                                      <Checkbox
                                        checked={isCompleted}
                                        onCheckedChange={() => handleToggle(todo.id, isCompleted)}
                                        disabled={isToggling}
                                        className="h-4.5 w-4.5 rounded-md border-border shrink-0 transition-transform active:scale-90"
                                      />

                                      <div className="min-w-0 flex-1 flex flex-col justify-center">
                                        <span
                                          className={`text-xs sm:text-sm truncate transition-colors ${
                                            isCompleted
                                              ? "line-through text-muted-foreground/70 font-normal"
                                              : "text-foreground font-semibold"
                                          }`}
                                        >
                                          {todo.title}
                                        </span>
                                        <span className="text-[10px] font-medium text-muted-foreground/75 flex items-center gap-1 mt-0.5">
                                          <Calendar className="w-2.5 h-2.5 text-primary/60 inline shrink-0" />
                                          <span>{formatAssignedDays(todo.assigned_day)}</span>
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                      <TaskWidget todo={todo} isCompleted={isCompleted} />
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            );
                          })
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      )}
    </div>
  );
}



