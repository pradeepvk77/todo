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
    <div className="flex flex-wrap gap-2" aria-label="Filter tasks">
      {filters.map((filter) => (
        <button
          key={filter.value}
          type="button"
          onClick={() => onChange(filter.value)}
          aria-pressed={value === filter.value}
          className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
            value === filter.value
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          {filter.label} <span className={`ml-1 rounded-full px-1.5 py-0.5 text-xs ${value === filter.value ? "bg-primary-foreground/15" : "bg-muted"}`}>{filter.count}</span>
        </button>
      ))}
    </div>
  );
}
