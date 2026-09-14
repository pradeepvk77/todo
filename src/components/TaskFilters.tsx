export type TaskFilter = "all" | "pending" | "completed";

export function TaskFilters({
  value,
  onChange,
  total,
  pending,
  completed,
}: {
  value: TaskFilter;
  onChange: (filter: TaskFilter) => void;
  total: number;
  pending: number;
  completed: number;
}) {
  const filters: { value: TaskFilter; label: string; count: number }[] = [
    { value: "all", label: "All", count: total },
    { value: "pending", label: "Pending", count: pending },
    { value: "completed", label: "Completed", count: completed },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Filter tasks">
      {filters.map((filter) => {
        const isActive = value === filter.value;
        return (
          <button
            key={filter.value}
            type="button"
            onClick={() => onChange(filter.value)}
            aria-pressed={isActive}
            className={`cursor-pointer inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
              isActive
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <span>{filter.label}</span>
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                isActive
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-background/80 text-muted-foreground border border-border/50"
              }`}
            >
              {filter.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

