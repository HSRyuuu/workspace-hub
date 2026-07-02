import { Button, PriorityDot } from "../../../components/ui";
import type { Todo } from "../types";

interface TodoListProps {
  todos: Todo[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onToggle: (todo: Todo) => void;
  onDelete: (id: number) => void;
  focusId?: number | null;
}

function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  );
}

function formatDueShort(due: string | null): string {
  return due ?? "";
}

function isDueOverdue(due: string | null, dueTime: number, status: string): boolean {
  if (!due || status === "done") return false;
  const h = Math.floor(dueTime / 60);
  const m = dueTime % 60;
  return new Date(`${due}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`).getTime() < Date.now();
}

export function TodoList({ todos, selectedId, onSelect, onToggle, onDelete, focusId }: TodoListProps) {
  if (todos.length === 0) {
    return <div className="empty-state">할 일이 없어요.</div>;
  }

  return (
    <div className="todo-list">
      {todos.map((t) => {
        const isDone = t.status === "done";
        const dueLabel = formatDueShort(t.due_date);
        const overdue = isDueOverdue(t.due_date, t.due_time, t.status);
        const isSelected = t.id === selectedId;
        const isFocused = t.id === focusId;

        return (
          <div
            key={t.id}
            className={[
              "todo-row",
              isDone ? "done" : "",
              isSelected ? "selected" : "",
              isFocused ? "focused" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => onSelect(t.id)}
          >
            <input
              className="todo-checkbox"
              type="checkbox"
              checked={isDone}
              onChange={(e) => {
                e.stopPropagation();
                onToggle(t);
              }}
              aria-label={isDone ? "완료 해제" : "완료"}
            />
            <span className="todo-title">{t.title}</span>
            <span className={`todo-due ${overdue ? "overdue" : ""}`}>
              {dueLabel}
            </span>
            <PriorityDot priority={t.priority} />
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              className="todo-delete"
              aria-label="삭제"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(t.id);
              }}
            >
              <TrashIcon />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
