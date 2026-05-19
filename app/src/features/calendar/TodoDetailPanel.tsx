import { useState } from "react";
import { Button } from "../../components/ui";
import { todoApi } from "../todo/api";
import type { Todo } from "../todo/types";
import { formatDateLocal, formatTimeLocal } from "./dateUtils";

interface TodoDetailPanelProps {
  todo: Todo;
  onToggled: (t: Todo) => void;
  onNavigateToTodo: (id: number) => void;
  onClose: () => void;
}

const PRIORITY_LABEL: Record<string, string> = {
  low: "낮음",
  mid: "보통",
  high: "높음",
};

export function TodoDetailPanel({
  todo,
  onToggled,
  onNavigateToTodo,
  onClose,
}: TodoDetailPanelProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const updated =
        todo.status === "done"
          ? await todoApi.uncomplete(todo.id)
          : await todoApi.complete(todo.id);
      onToggled(updated);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  const due = todo.due_at;
  const dueLabel = due ? `${formatDateLocal(due)} ${formatTimeLocal(due)}` : "—";

  return (
    <div className="cal-editor">
      <div className="cal-editor-header">
        <h3>TODO</h3>
        <button type="button" className="cal-editor-close" onClick={onClose} aria-label="닫기">
          ×
        </button>
      </div>

      {error && <div className="error-banner">⚠ {error}</div>}

      <div className="cal-todo-readonly">
        <div className={`cal-todo-title ${todo.status === "done" ? "done" : ""}`}>
          {todo.title}
        </div>
        <dl className="cal-todo-meta">
          <dt>상태</dt>
          <dd>{todo.status === "done" ? "완료" : "열림"}</dd>
          <dt>우선순위</dt>
          <dd>{PRIORITY_LABEL[todo.priority] ?? todo.priority}</dd>
          <dt>마감</dt>
          <dd>{dueLabel}</dd>
        </dl>
        {todo.description && (
          <p className="cal-todo-desc">{todo.description}</p>
        )}
      </div>

      <div className="cal-editor-actions">
        <Button variant="primary" onClick={toggle} disabled={busy}>
          {todo.status === "done" ? "완료 해제" : "완료"}
        </Button>
        <Button variant="secondary" onClick={() => onNavigateToTodo(todo.id)}>
          TODO 페이지로
        </Button>
      </div>
    </div>
  );
}
