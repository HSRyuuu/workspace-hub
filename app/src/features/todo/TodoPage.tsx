import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { showConfirmToast } from "../../components/ui/ConfirmToast";
import type { MarkdownEditorHandle } from "../../components/ui/MarkdownEditor";
import { showErrorToast } from "../../components/ui/Toast";
import { todoApi } from "./api";
import { AddBar } from "./components/AddBar";
import { TodoDetail } from "./components/TodoDetail";
import { TodoFilters } from "./components/TodoFilters";
import { TodoList } from "./components/TodoList";
import { useDebouncedUpdate } from "./hooks/useDebouncedUpdate";
import type { Filters } from "./components/TodoFilters";
import type { Priority, Todo, TodoPatch } from "./types";

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isLastWeek(dateStr: string): boolean {
  const d = new Date(dateStr).getTime();
  const now = new Date();
  const thisWeekStart = new Date(now);
  thisWeekStart.setHours(0, 0, 0, 0);
  thisWeekStart.setDate(now.getDate() - now.getDay());
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(thisWeekStart.getDate() - 7);
  return d >= lastWeekStart.getTime() && d < thisWeekStart.getTime();
}

function isThisMonth(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function applyDueRangeFilter(todos: Todo[], dueRange: Filters["dueRange"]): Todo[] {
  if (dueRange === "all") return todos;
  const now = Date.now();
  return todos.filter((t) => {
    if (!t.due_at) return false;
    if (dueRange === "today") return isToday(t.due_at);
    if (dueRange === "last-week") return isLastWeek(t.due_at);
    if (dueRange === "this-month") return isThisMonth(t.due_at);
    if (dueRange === "overdue") return new Date(t.due_at).getTime() < now && t.status === "open";
    return true;
  });
}

export default function TodoPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filters, setFilters] = useState<Filters>({
    query: "",
    priorities: new Set<Priority>(),
    dueRange: "all",
    tab: "all",
  });
  const [loading, setLoading] = useState(false);

  const descriptionRef = useRef<MarkdownEditorHandle>(null);
  const snapshotsRef = useRef(new Map<number, Todo>());

  // 초기 로드 (새로고침 핸들러 없음 — 인라인 즉시 저장이 stale 방지)
  useEffect(() => {
    setLoading(true);
    todoApi
      .list()
      .then((list) => {
        setTodos(list);
        list.forEach((t) => snapshotsRef.current.set(t.id, t));
      })
      .catch((e: unknown) => showErrorToast(String(e)))
      .finally(() => setLoading(false));
  }, []);

  // ── useDebouncedUpdate ──────────────────────────────────────────────────────
  const onApply = useCallback((updated: Todo) => {
    snapshotsRef.current.set(updated.id, updated);
    setTodos((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }, []);

  const onRollback = useCallback((id: number) => {
    const snap = snapshotsRef.current.get(id);
    if (snap) {
      setTodos((prev) => prev.map((t) => (t.id === id ? snap : t)));
    }
  }, []);

  const { update } = useDebouncedUpdate({
    updateFn: todoApi.update,
    onApply,
    onRollback,
    onError: (msg, retry) => showErrorToast(msg, retry),
  });

  const onPatch = useCallback(
    (id: number, patch: TodoPatch, debounce = true) => update(id, patch, debounce),
    [update],
  );

  // ── 필터링 ─────────────────────────────────────────────────────────────────
  const filteredTodos = useMemo(() => {
    let result = todos;
    if (filters.tab !== "all") {
      result = result.filter((t) => t.status === filters.tab);
    }
    if (filters.query.trim()) {
      const q = filters.query.toLowerCase();
      result = result.filter((t) => t.title.toLowerCase().includes(q));
    }
    if (filters.priorities.size > 0) {
      result = result.filter((t) => filters.priorities.has(t.priority));
    }
    result = applyDueRangeFilter(result, filters.dueRange);
    return result;
  }, [todos, filters]);

  const selectedTodo = todos.find((t) => t.id === selectedId) ?? null;

  // ── 핸들러 ─────────────────────────────────────────────────────────────────
  const onAdd = useCallback(async (title: string) => {
    try {
      const newTodo = await todoApi.add({ title, priority: "mid" });
      snapshotsRef.current.set(newTodo.id, newTodo);
      setTodos((prev) => [newTodo, ...prev]);
      setFilters({
        query: "",
        priorities: new Set<Priority>(),
        dueRange: "all",
        tab: "all",
      });
      setSelectedId(newTodo.id);
      setTimeout(() => descriptionRef.current?.focus(), 0);
    } catch (e: unknown) {
      showErrorToast(String(e));
    }
  }, []);

  const onToggle = useCallback(
    async (todo: Todo) => {
      try {
        const updated =
          todo.status === "done"
            ? await todoApi.uncomplete(todo.id)
            : await todoApi.complete(todo.id);
        onApply(updated);
      } catch (e: unknown) {
        showErrorToast(String(e));
      }
    },
    [onApply],
  );

  const onDelete = useCallback((id: number) => {
    showConfirmToast({
      message: "정말 삭제할까요?",
      confirmLabel: "삭제",
      cancelLabel: "취소",
      onConfirm: () => {
        todoApi
          .delete(id)
          .then(() => {
            snapshotsRef.current.delete(id);
            setTodos((prev) => prev.filter((t) => t.id !== id));
            setSelectedId((prev) => (prev === id ? null : prev));
          })
          .catch((e: unknown) => showErrorToast(String(e)));
      },
    });
  }, []);

  return (
    <>
      <AddBar onAdd={(t) => void onAdd(t)} />
      <TodoFilters filters={filters} onChange={setFilters} />

      {loading && todos.length === 0 ? (
        <div className="empty-state">불러오는 중…</div>
      ) : (
        <div
          className="todo-split"
          style={{ display: "grid", gridTemplateColumns: "5fr 7fr", gap: "1rem" }}
        >
          <div>
            <TodoList
              todos={filteredTodos}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onToggle={(t) => void onToggle(t)}
              onDelete={onDelete}
            />
          </div>
          <div>
            <TodoDetail
              todo={selectedTodo}
              descriptionRef={descriptionRef}
              onPatch={onPatch}
            />
          </div>
        </div>
      )}
    </>
  );
}
