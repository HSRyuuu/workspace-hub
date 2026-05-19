import { PriorityToggle, Select, TabsUnderline } from "../../../components/ui";
import type { SelectOption, TabItem } from "../../../components/ui";
import type { Priority } from "../types";

export type DueRange = "all" | "today" | "last-week" | "this-month" | "overdue";
export type TodoTab = "all" | "open" | "done";

export interface Filters {
  query: string;
  priorities: Set<Priority>;
  dueRange: DueRange;
  tab: TodoTab;
}

interface TodoFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

const PRIORITY_LABELS: Record<Priority, string> = {
  low: "낮음",
  mid: "보통",
  high: "높음",
};

const STATUS_TABS: TabItem<TodoTab>[] = [
  { value: "all", label: "전체" },
  { value: "open", label: "열림" },
  { value: "done", label: "완료" },
];

const DUE_OPTIONS: SelectOption<DueRange>[] = [
  { value: "all", label: "전체기간" },
  { value: "today", label: "오늘" },
  { value: "last-week", label: "지난주" },
  { value: "this-month", label: "이번달" },
  { value: "overdue", label: "지난건" },
];

export function TodoFilters({ filters, onChange }: TodoFiltersProps) {
  const togglePriority = (p: Priority) => {
    const next = new Set(filters.priorities);
    if (next.has(p)) {
      next.delete(p);
    } else {
      next.add(p);
    }
    onChange({ ...filters, priorities: next });
  };

  return (
    <div className="todo-filters">
      <TabsUnderline
        items={STATUS_TABS}
        value={filters.tab}
        onChange={(tab) => onChange({ ...filters, tab })}
        ariaLabel="상태별 필터"
      />

      <div className="todo-filters-toolbar">
        <div className="todo-filters-due">
          <Select<DueRange>
            value={filters.dueRange}
            options={DUE_OPTIONS}
            onChange={(dueRange) => onChange({ ...filters, dueRange })}
            ariaLabel="마감 범위 필터"
            width={120}
          />
        </div>

        <input
          className="input todo-filters-search"
          placeholder="제목 검색"
          value={filters.query}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
          aria-label="할 일 검색"
        />

        <div
          className="todo-filters-priorities"
          role="group"
          aria-label="우선순위 필터"
        >
          {(["low", "mid", "high"] as Priority[]).map((p) => (
            <PriorityToggle
              key={p}
              priority={p}
              active={filters.priorities.has(p)}
              label={PRIORITY_LABELS[p]}
              onClick={() => togglePriority(p)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
