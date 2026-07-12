import { useEffect, useMemo, useState } from "react";
import { Button, PriorityDot, showErrorToast } from "../../components/ui";
import { ChevronIcon, FolderIcon } from "../../components/ui/icons";
import { todayIso } from "../calendar/dateUtils";
import { memoDisplayTitle } from "../memo/markdown";
import type { Memo } from "../memo/types";
import type { Todo } from "../todo/types";
import { todayApi } from "./api";
import { elapsedDays, weekEndIso } from "./dateUtils";
import type { DashboardSummary } from "./types";

interface TodayPageProps {
  onNavigateToTodo(id: number | null): void;
  onNavigateToMemo(id: number): void;
}

const EMPTY_SUMMARY: DashboardSummary = {
  due_todos: [],
  open_todos: [],
  open_total: 0,
  recent_memos: [],
  recent_folders: [],
};

function TodoRow({
  todo,
  className = "",
  meta,
  onClick,
}: {
  todo: Todo;
  className?: string;
  meta: string;
  onClick(): void;
}) {
  return (
    <button
      type="button"
      className={`today-row today-todo-row ${className}`.trim()}
      aria-label={`${todo.title}, ${meta}`}
      onClick={onClick}
    >
      <PriorityDot priority={todo.priority} />
      <span className="today-row-title">{todo.title}</span>
      <span className="today-row-meta">{meta}</span>
      <ChevronIcon size={13} />
    </button>
  );
}

function DueGroup({
  title,
  todos,
  className = "",
  onNavigate,
}: {
  title: string;
  todos: Todo[];
  className?: string;
  onNavigate(id: number): void;
}) {
  if (todos.length === 0) return null;
  return (
    <div className={`today-due-group ${className}`.trim()}>
      <h3>{title}</h3>
      <div className="today-list">
        {todos.map((todo) => (
          <TodoRow
            key={todo.id}
            todo={todo}
            meta={todo.due_date ?? ""}
            onClick={() => onNavigate(todo.id)}
          />
        ))}
      </div>
    </div>
  );
}

function memoUpdatedLabel(memo: Memo, today: string): string {
  const days = elapsedDays(memo.updated_at, today);
  if (days === 0) return "오늘 수정";
  if (days === 1) return "어제 수정";
  return `${days}일 전 수정`;
}

function folderName(path: string): string {
  return path.split("/").filter(Boolean).at(-1) ?? path;
}

export default function TodayPage({ onNavigateToTodo, onNavigateToMemo }: TodayPageProps) {
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const today = todayIso();
  const weekEnd = weekEndIso(today);

  useEffect(() => {
    todayApi
      .summary(weekEnd)
      .then(setSummary)
      .catch((error: unknown) => {
        setSummary(EMPTY_SUMMARY);
        showErrorToast(String(error));
      });
  }, [weekEnd]);

  const dueGroups = useMemo(
    () => ({
      overdue: summary.due_todos.filter((todo) => todo.due_date !== null && todo.due_date < today),
      today: summary.due_todos.filter((todo) => todo.due_date === today),
      week: summary.due_todos.filter(
        (todo) => todo.due_date !== null && todo.due_date > today && todo.due_date <= weekEnd,
      ),
    }),
    [summary.due_todos, today, weekEnd],
  );
  const dueCount = dueGroups.overdue.length + dueGroups.today.length + dueGroups.week.length;
  const hasDueTodos = dueCount > 0;
  const remainingOpen = Math.max(0, summary.open_total - summary.open_todos.length);

  return (
    <div className="today-page">
      <header className="today-header">
        <p>WORKSPACE HUB</p>
        <h1>Today</h1>
        <span>{today}</span>
      </header>

      <div className="today-grid">
        <section className="today-card today-card--due" aria-labelledby="today-due-heading">
          <div className="today-section-head">
            <h2 id="today-due-heading">마감</h2>
            <span>{dueCount}</span>
          </div>
          {hasDueTodos ? (
            <div className="today-due-groups">
              <DueGroup
                title="지난 마감"
                todos={dueGroups.overdue}
                className="today-due-overdue"
                onNavigate={onNavigateToTodo}
              />
              <DueGroup title="오늘" todos={dueGroups.today} onNavigate={onNavigateToTodo} />
              <DueGroup title="이번 주" todos={dueGroups.week} onNavigate={onNavigateToTodo} />
            </div>
          ) : (
            <p className="today-empty">마감된 TODO가 없습니다.</p>
          )}
        </section>

        <section className="today-card" aria-labelledby="today-open-heading">
          <div className="today-section-head">
            <h2 id="today-open-heading">미완료 TODO</h2>
            <span>{summary.open_total}</span>
          </div>
          {summary.open_todos.length > 0 ? (
            <div className="today-list">
              {summary.open_todos.map((todo) => {
                const days = elapsedDays(todo.created_at, today);
                return (
                  <TodoRow
                    key={todo.id}
                    todo={todo}
                    className={days >= 7 ? "today-row--stale" : ""}
                    meta={`${days}일 경과`}
                    onClick={() => onNavigateToTodo(todo.id)}
                  />
                );
              })}
              {remainingOpen > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="today-more"
                  onClick={() => onNavigateToTodo(null)}
                >
                  {remainingOpen}건 더
                </Button>
              )}
            </div>
          ) : (
            <p className="today-empty">미완료 TODO가 없습니다.</p>
          )}
        </section>

        <section className="today-card" aria-labelledby="today-memo-heading">
          <div className="today-section-head">
            <h2 id="today-memo-heading">최근 메모</h2>
            <span>{summary.recent_memos.length}</span>
          </div>
          {summary.recent_memos.length > 0 ? (
            <div className="today-list">
              {summary.recent_memos.map((memo) => {
                const title = memoDisplayTitle(memo);
                const updatedLabel = memoUpdatedLabel(memo, today);
                return (
                  <button
                    key={memo.id}
                    type="button"
                    className="today-row"
                    aria-label={`${title}, ${updatedLabel}`}
                    onClick={() => onNavigateToMemo(memo.id)}
                  >
                    <span className="today-row-title">{title}</span>
                    <span className="today-row-meta">{updatedLabel}</span>
                    <ChevronIcon size={13} />
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="today-empty">최근 메모가 없습니다.</p>
          )}
        </section>

        <section className="today-card" aria-labelledby="today-folder-heading">
          <div className="today-section-head">
            <h2 id="today-folder-heading">최근 폴더</h2>
            <span>{summary.recent_folders.length}</span>
          </div>
          {summary.recent_folders.length > 0 ? (
            <div className="today-list">
              {summary.recent_folders.map((folder) => {
                const name = folderName(folder.path);
                return (
                  <button
                    key={folder.id}
                    type="button"
                    className="today-row"
                    aria-label={`${name}, Finder에서 열기`}
                    onClick={() =>
                      todayApi.openInFinder(folder.path).catch((error: unknown) => {
                        showErrorToast(String(error));
                      })
                    }
                  >
                    <FolderIcon size={15} />
                    <span className="today-row-title">{name}</span>
                    <span className="today-row-meta today-folder-path">{folder.path}</span>
                    <ChevronIcon size={13} />
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="today-empty">최근 폴더가 없습니다.</p>
          )}
        </section>
      </div>
    </div>
  );
}
