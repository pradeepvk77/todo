"use client";

import { useState, useTransition, useSyncExternalStore } from "react";
import { Todo, DaySection } from "@/lib/db";
import { toggleTodo, updateTaskSectionAndOrder, updateTaskOrder } from "@/app/actions";
import { TaskWidget } from "@/components/TaskWidget";
import { TaskCircleCheckbox } from "@/components/TaskCircleCheckbox";
import { CompleteTaskValueModal } from "@/components/CompleteTaskValueModal";
import { formatAssignedDays } from "@/lib/time-utils";
import { GripVertical, CheckSquare, Calendar, CheckCircle2, Sparkles, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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

const SECTION_INFO: Record<DaySection, { label: string; icon: string }> = {
  MORNING: { label: "Morning", icon: "🌅" },
  AFTERNOON: { label: "Afternoon", icon: "☀️" },
  EVENING: { label: "Evening", icon: "🌆" },
  NIGHT: { label: "Night", icon: "🌙" },
};

const emptySubscribe = () => () => {};

function getCurrentDaySection(): DaySection {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "Asia/Kolkata",
    }).format(new Date())
  );
  if (hour >= 5 && hour < 12) return "MORNING";
  if (hour >= 12 && hour < 17) return "AFTERNOON";
  if (hour >= 17 && hour < 20) return "EVENING";
  return "NIGHT";
}

interface NextGuidance {
  type: "next_task" | "section_complete" | "all_complete" | "none";
  nextTask?: Todo;
  nextSectionKey?: DaySection;
  nextSectionLabel?: string;
  nextSectionIcon?: string;
  completedSectionLabel?: string;
  completedSectionIcon?: string;
  completedSectionTotal?: number;
}

/**
 * Compute the next guidance state from the full todos array.
 * Always operates on the FULL list, never the filtered/visible subset,
 * so filter changes don't distort next-task recommendations.
 */
function calculateNextGuidance(todos: Todo[], lastCompletedId?: number | null): NextGuidance {
  const totalCount = todos.length;
  if (totalCount === 0) return { type: "none" };

  const completedCount = todos.filter((t) => t.completed).length;
  if (completedCount === totalCount) return { type: "all_complete" };

  const pendingTodos = todos.filter((t) => !t.completed);

  const lastCompletedTask = lastCompletedId ? todos.find((t) => t.id === lastCompletedId) : null;
  const targetSection: DaySection = lastCompletedTask?.day_section || "MORNING";
  const SECTION_ORDER: DaySection[] = ["MORNING", "AFTERNOON", "EVENING", "NIGHT"];

  // Priority 1: next pending task in the same section
  const sameSectionPending = pendingTodos.filter(
    (t) => (t.day_section || "MORNING") === targetSection
  );
  if (sameSectionPending.length > 0) {
    return {
      type: "next_task",
      nextTask: sameSectionPending[0],
      nextSectionKey: targetSection,
      nextSectionLabel: SECTION_INFO[targetSection].label,
      nextSectionIcon: SECTION_INFO[targetSection].icon,
    };
  }

  // Priority 2: section complete → walk daily order, skip empty sections
  const targetSecIndex = SECTION_ORDER.indexOf(targetSection);
  const targetSecTotal = todos.filter(
    (t) => (t.day_section || "MORNING") === targetSection
  ).length;

  for (let i = 1; i <= 3; i++) {
    const nextSecKey = SECTION_ORDER[(targetSecIndex + i) % 4];
    const nextSecPending = pendingTodos.filter(
      (t) => (t.day_section || "MORNING") === nextSecKey
    );
    if (nextSecPending.length > 0) {
      return {
        type: "section_complete",
        completedSectionLabel: SECTION_INFO[targetSection].label,
        completedSectionIcon: SECTION_INFO[targetSection].icon,
        completedSectionTotal: targetSecTotal,
        nextTask: nextSecPending[0],
        nextSectionKey: nextSecKey,
        nextSectionLabel: SECTION_INFO[nextSecKey].label,
        nextSectionIcon: SECTION_INFO[nextSecKey].icon,
      };
    }
  }

  // Priority 3: fallback — first pending anywhere
  const firstPending = pendingTodos[0];
  const firstSec = firstPending.day_section || "MORNING";
  return {
    type: "next_task",
    nextTask: firstPending,
    nextSectionKey: firstSec,
    nextSectionLabel: SECTION_INFO[firstSec].label,
    nextSectionIcon: SECTION_INFO[firstSec].icon,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function TodoList({ initialTodos }: TodoListProps) {
  const [todos, setTodos] = useState<Todo[]>(initialTodos);
  const [prevInitialTodos, setPrevInitialTodos] = useState<Todo[]>(initialTodos);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [justCompletedId, setJustCompletedId] = useState<number | null>(null);
  const [lastCompletedId, setLastCompletedId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [, startTransition] = useTransition();

  const currentSection = useSyncExternalStore<DaySection>(
    emptySubscribe,
    getCurrentDaySection,
    () => "MORNING"
  );

  // Sync when server re-renders with fresh data
  if (initialTodos !== prevInitialTodos) {
    setPrevInitialTodos(initialTodos);
    setTodos(initialTodos);
  }

  const [valueModalTask, setValueModalTask] = useState<Todo | null>(null);

  const executeToggle = (id: number, currentCompleted: boolean, completedValue?: number | null) => {
    const targetTask = todos.find((t) => t.id === id);
    const nextCompleted = !currentCompleted;

    if (nextCompleted && targetTask) {
      setLastCompletedId(id);
      setJustCompletedId(id);
      setTimeout(() => setJustCompletedId((prev) => (prev === id ? null : prev)), 750);
      const msg = `✓ ${targetTask.title} completed! 🎉`;
      setToastMessage(msg);
      setTimeout(() => {
        setToastMessage((m) => (m === msg ? null : m));
      }, 2800);
    } else {
      setToastMessage(null);
    }

    setTogglingId(id);
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: nextCompleted } : t))
    );

    startTransition(async () => {
      try {
        await toggleTodo(id, currentCompleted, completedValue);
      } finally {
        setTogglingId(null);
      }
    });
  };

  // ─── Core toggle — single source of truth for task completion ────────────
  const handleToggle = (id: number, currentCompleted: boolean) => {
    const targetTask = todos.find((t) => t.id === id);
    const isMeasurable = Boolean(targetTask?.track_progress);

    if (!currentCompleted && isMeasurable && targetTask) {
      setValueModalTask(targetTask);
      return;
    }

    executeToggle(id, currentCompleted);
  };

  // ─── Drag and drop ───────────────────────────────────────────────────────
  const handleDragEnd = (result: DropResult) => {
    if (filter !== "all") return;
    const { destination, source, draggableId } = result;
    if (!destination) return;

    const sourceSection = source.droppableId as DaySection;
    const destSection = destination.droppableId as DaySection;
    const destIndex = destination.index;
    const taskId = parseInt(draggableId, 10);

    if (sourceSection === destSection && source.index === destIndex) return;

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

  // ─── Empty state ─────────────────────────────────────────────────────────
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

  const pendingCount = todos.filter((t) => !t.completed).length;
  const completedCount = todos.length - pendingCount;
  const visibleTodos = todos.filter((t) =>
    filter === "all" ? true : filter === "completed" ? t.completed : !t.completed
  );

  // Guidance always computed from the FULL list
  const guidance = calculateNextGuidance(todos, lastCompletedId);

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      {toastMessage && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="bg-foreground text-background text-xs font-semibold px-3.5 py-2 rounded-full shadow-lg border border-border/20 flex items-center gap-2 animate-in fade-in-50 zoom-in-95 duration-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <TaskFilters
        value={filter}
        onChange={setFilter}
        total={todos.length}
        pending={pendingCount}
        completed={completedCount}
      />

      {/* ── Guidance / Next Up ────────────────────────────────────────────── */}

      {/* All tasks complete */}
      {guidance.type === "all_complete" && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-center space-y-1 animate-in fade-in-50 duration-300">
          <div className="flex items-center justify-center gap-1.5 text-sm font-bold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span>Today&apos;s tasks are complete</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {todos.length} of {todos.length} completed. Nice work. Enjoy the rest of your day.
          </p>
        </div>
      )}

      {/* Section complete → shows next section's first task */}
      {guidance.type === "section_complete" && guidance.nextTask && (
        <div className="rounded-xl border border-border/80 bg-card shadow-2xs overflow-hidden animate-in fade-in-50 duration-300">
          {/* section complete header */}
          <div className="flex items-center justify-between px-3.5 py-2 border-b border-border/60 bg-emerald-500/5">
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
              <span>{guidance.completedSectionIcon}</span>
              <span>{guidance.completedSectionLabel} complete</span>
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              {guidance.completedSectionTotal} / {guidance.completedSectionTotal}
            </span>
          </div>
          {/* actionable next task row */}
          <div className="flex items-center gap-3 px-3.5 py-2.5">
            <TaskCircleCheckbox
              checked={false}
              onCheckedChange={() =>
                handleToggle(guidance.nextTask!.id, guidance.nextTask!.completed)
              }
              disabled={togglingId === guidance.nextTask.id}
              label={`Complete ${guidance.nextTask.title}`}
              size="md"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-500 flex items-center gap-1 mb-0.5">
                <Sparkles className="w-3 h-3" />
                Next up
              </p>
              <p className="text-sm font-bold text-foreground truncate leading-snug">
                {guidance.nextSectionIcon} {guidance.nextTask.title}
              </p>
            </div>
            <span className="text-[10px] font-medium text-muted-foreground/80 bg-muted/60 px-2 py-0.5 rounded-md border border-border/50 shrink-0">
              {guidance.nextSectionLabel}
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
          </div>
        </div>
      )}

      {/* Next task in current section
      {guidance.type === "next_task" && guidance.nextTask && (
        <div className="rounded-xl border border-border/80 bg-card shadow-2xs overflow-hidden animate-in fade-in-50 duration-300">
          <div className="flex items-center gap-3 px-3.5 py-2.5">
            <TaskCircleCheckbox
              checked={false}
              onCheckedChange={() =>
                handleToggle(guidance.nextTask!.id, guidance.nextTask!.completed)
              }
              disabled={togglingId === guidance.nextTask.id}
              label={`Complete ${guidance.nextTask.title}`}
              size="md"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-500 flex items-center gap-1 mb-0.5">
                <Sparkles className="w-3 h-3" />
                Next up
              </p>
              <p className="text-sm font-bold text-foreground truncate leading-snug">
                {guidance.nextSectionIcon} {guidance.nextTask.title}
              </p>
            </div>
            <span className="text-[10px] font-medium text-muted-foreground/80 bg-muted/60 px-2 py-0.5 rounded-md border border-border/50 shrink-0">
              {guidance.nextSectionLabel}
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
          </div>
        </div>
      )} */}

      {/* ── Task list ─────────────────────────────────────────────────────── */}
      {visibleTodos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/70 px-4 py-6 text-center text-xs text-muted-foreground">
          No {filter} tasks for today.
        </p>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="space-y-3.5 pt-1">
            {SECTIONS.map((sec) => {
              const sectionTodos = visibleTodos.filter(
                (t) => (t.day_section || "MORNING") === sec.key
              );
              const sectionCompleted = sectionTodos.filter((t) => t.completed).length;
              const sectionTotal = sectionTodos.length;
              const isCurrentSection = currentSection === sec.key;

              return (
                <div key={sec.key} className="space-y-1.5">
                  {/* Section header */}
                  <div className="flex items-center justify-between pb-1 border-b border-border/60">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground/90 flex items-center gap-1.5">
                        <span>{sec.icon}</span>
                        <span>{sec.label}</span>
                      </h3>
                      {isCurrentSection && (
                        <span className="text-[9px] font-extrabold tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 leading-none">
                          NOW
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground/80">
                      {sectionCompleted} / {sectionTotal}
                    </span>
                  </div>

                  <Droppable droppableId={sec.key}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={[
                          "transition-colors",
                          snapshot.isDraggingOver
                            ? "rounded-xl border border-primary/50 bg-primary/5 p-1"
                            : "",
                          sectionTotal > 0
                            ? "rounded-xl border border-border/80 bg-card shadow-2xs divide-y divide-border/60 overflow-hidden"
                            : "min-h-[38px] rounded-lg border border-dashed border-border/50 bg-muted/15 flex items-center justify-center p-2",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {sectionTotal === 0 ? (
                          <p className="text-[11px] text-muted-foreground/60 font-medium select-none">
                            Drag tasks here
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
                                      "px-3 py-2 sm:px-3.5 flex items-center justify-between gap-3 transition-all duration-300 relative overflow-hidden",
                                      justCompletedId === todo.id
                                        ? "animate-row-flash bg-emerald-500/15"
                                        : isCompleted
                                        ? "bg-muted/30 dark:bg-muted/15"
                                        : "bg-card hover:bg-muted/20",
                                      snapshot.isDragging
                                        ? "shadow-md ring-1 ring-primary/20 bg-background rounded-lg"
                                        : "",
                                    ]
                                      .filter(Boolean)
                                      .join(" ")}
                                  >
                                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                      {/* Drag handle */}
                                      {filter === "all" && (
                                        <div
                                          {...provided.dragHandleProps}
                                          className="text-muted-foreground/50 hover:text-foreground cursor-grab active:cursor-grabbing p-0.5 rounded shrink-0"
                                          title="Drag to reorder or move section"
                                        >
                                          <GripVertical className="w-4 h-4" />
                                        </div>
                                      )}

                                      {/* Circular checkbox */}
                                      <TaskCircleCheckbox
                                        checked={isCompleted}
                                        onCheckedChange={() =>
                                          handleToggle(todo.id, isCompleted)
                                        }
                                        disabled={isToggling}
                                        label={
                                          isCompleted
                                            ? `Mark ${todo.title} as incomplete`
                                            : `Complete ${todo.title}`
                                        }
                                        size="md"
                                      />

                                      {/* Task text */}
                                      <div className="min-w-0 flex-1 flex flex-col justify-center">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <span
                                            className={`text-xs sm:text-sm truncate transition-all duration-300 ${
                                              todo.skipped
                                                ? "line-through text-rose-500/80 font-normal"
                                                : isCompleted
                                                ? "line-through text-muted-foreground/60 font-normal"
                                                : "text-foreground font-semibold"
                                            }`}
                                          >
                                            {todo.title}
                                          </span>
                                          {todo.skipped && (
                                            <span className="text-[9px] font-bold text-rose-600 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20 shrink-0 flex items-center gap-0.5">
                                              <span>❌</span>
                                              <span>Skipped</span>
                                            </span>
                                          )}
                                        </div>
                                        <span className="text-[10px] font-medium text-muted-foreground/75 flex items-center gap-1 mt-0.5">
                                          <Calendar className="w-2.5 h-2.5 text-primary/60 inline shrink-0" />
                                          <span>{formatAssignedDays(todo.assigned_day)}</span>
                                        </span>
                                      </div>
                                    </div>

                                    {/* Widget (time picker / counter / input) */}
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

      <CompleteTaskValueModal
        isOpen={!!valueModalTask}
        onClose={() => setValueModalTask(null)}
        todo={valueModalTask}
        onConfirm={(completedVal) => {
          if (valueModalTask) {
            const taskId = valueModalTask.id;
            setValueModalTask(null);
            executeToggle(taskId, false, completedVal);
          }
        }}
      />
    </div>
  );
}
