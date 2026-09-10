"use client";

import { useState, useTransition } from "react";
import { Todo } from "@/lib/db";
import { toggleTodo, deleteTodo, updateTaskOrder } from "@/app/actions";
import { TaskWidget } from "@/components/TaskWidget";
import { Trash2, GripVertical, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";

interface TodoListProps {
  initialTodos: Todo[];
}

export function TodoList({ initialTodos }: TodoListProps) {
  const [todos, setTodos] = useState<Todo[]>(initialTodos);
  const [prevInitialTodos, setPrevInitialTodos] = useState<Todo[]>(initialTodos);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
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

  const handleDelete = (id: number) => {
    setDeletingId(id);
    setTodos((prev) => prev.filter((t) => t.id !== id));
    startTransition(async () => {
      try {
        await deleteTodo(id);
      } finally {
        setDeletingId(null);
      }
    });
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;

    const items = Array.from(todos);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    setTodos(items);

    const orderedIds = items.map((item) => item.id);
    startTransition(async () => {
      await updateTaskOrder(orderedIds);
    });
  };

  if (todos.length === 0) {
    return (
      <Card className="border border-border bg-card p-8 text-center shadow-xs rounded-xl">
        <CardContent className="space-y-3 pt-4">
          <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mx-auto text-muted-foreground border border-border">
            <CheckSquare className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-card-foreground">No tasks scheduled for today</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Click the <strong className="text-foreground font-medium">+ Add Task</strong> button to get started.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="todo-list">
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
          >
            {todos.map((todo, index) => {
              const isCompleted = todo.completed;
              const isToggling = togglingId === todo.id;
              const isDeleting = deletingId === todo.id;

              return (
                <Draggable
                  key={todo.id.toString()}
                  draggableId={todo.id.toString()}
                  index={index}
                >
                  {(provided, snapshot) => (
                    // Rule: spread draggableProps + style exactly as-is.
                    // No extra className transitions here — the library owns
                    // this element's transform/transition completely.
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      style={provided.draggableProps.style}
                      className="pb-2.5"
                    >
                      {/* Visual styling goes on the inner Card, not the wrapper */}
                      <Card
                        className={[
                          "border border-border bg-card rounded-xl shadow-xs",
                          isCompleted ? "opacity-60" : "",
                          snapshot.isDragging ? "shadow-md ring-1 ring-border" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <CardContent className="p-3 sm:p-3.5 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div
                              {...provided.dragHandleProps}
                              className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing p-1 rounded flex-shrink-0"
                            >
                              <GripVertical className="w-4 h-4" />
                            </div>

                            <Checkbox
                              checked={isCompleted}
                              onCheckedChange={() => handleToggle(todo.id, isCompleted)}
                              disabled={isToggling}
                            />

                            <span
                              className={`text-card-foreground text-sm font-medium truncate ${
                                isCompleted ? "line-through text-muted-foreground" : ""
                              }`}
                            >
                              {todo.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <TaskWidget todo={todo} isCompleted={isCompleted} />

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(todo.id)}
                              disabled={isDeleting}
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                              title="Delete task"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </Draggable>
              );
            })}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
