import { useCallback, useEffect, useState } from "react";
import { Button, showErrorToast } from "../../components/ui";
import { todoApi } from "../todo/api";
import type { Todo } from "../todo/types";
import { MonthGrid } from "./MonthGrid";
import { ScheduleEditor } from "./ScheduleEditor";
import { TodoDetailPanel } from "./TodoDetailPanel";
import { scheduleApi } from "./api";
import { monthFetchRange, shiftMonth, utcRangeForLocalDateRange } from "./dateUtils";
import type { Schedule } from "./types";

type Selection =
  | { kind: "schedule"; id: number }
  | { kind: "todo"; id: number }
  | { kind: "compose"; dayIso: string }
  | null;

interface CalendarPageProps {
  onNavigateToTodo: (id: number) => void;
}

export default function CalendarPage({ onNavigateToTodo }: CalendarPageProps) {
  const now = new Date();
  const [cursor, setCursor] = useState<{ year: number; month: number }>({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [selection, setSelection] = useState<Selection>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const range = monthFetchRange(cursor.year, cursor.month);
      const completedRange = utcRangeForLocalDateRange(range.from, range.to);
      const [s, t] = await Promise.all([
        scheduleApi.listRange(range.from, range.to),
        todoApi.listCalendarRange(
          range.from,
          range.to,
          completedRange.completedFrom,
          completedRange.completedTo,
        ),
      ]);
      setSchedules(s);
      setTodos(t);
    } catch (e) {
      showErrorToast(String(e));
    } finally {
      setLoading(false);
    }
  }, [cursor.year, cursor.month]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selectedSchedule =
    selection?.kind === "schedule"
      ? schedules.find((s) => s.id === selection.id) ?? null
      : null;
  const selectedTodo =
    selection?.kind === "todo" ? todos.find((t) => t.id === selection.id) ?? null : null;
  const composeDayIso = selection?.kind === "compose" ? selection.dayIso : null;

  function gotoMonth(delta: number) {
    setCursor((c) => shiftMonth(c.year, c.month, delta));
    setSelection(null);
  }
  function gotoToday() {
    const d = new Date();
    setCursor({ year: d.getFullYear(), month: d.getMonth() + 1 });
    setSelection(null);
  }

  return (
    <div className="cal-shell">
      <div className="cal-toolbar">
        <Button variant="secondary" onClick={() => gotoMonth(-1)} aria-label="이전 달">
          ‹
        </Button>
        <div className="cal-cursor">
          {cursor.year}년 {cursor.month}월
        </div>
        <Button variant="secondary" onClick={() => gotoMonth(1)} aria-label="다음 달">
          ›
        </Button>
        <Button variant="ghost" onClick={gotoToday}>
          오늘
        </Button>
      </div>

      <div className="cal-split">
        <div className="cal-split-grid">
          {loading && schedules.length === 0 && todos.length === 0 ? (
            <div className="empty-state">불러오는 중…</div>
          ) : (
            <MonthGrid
              year={cursor.year}
              month={cursor.month}
              schedules={schedules}
              todos={todos}
              selected={selection}
              onSelectSchedule={(id) => setSelection({ kind: "schedule", id })}
              onSelectTodo={(id) => setSelection({ kind: "todo", id })}
              onCompose={(dayIso) => setSelection({ kind: "compose", dayIso })}
            />
          )}
        </div>
        <aside className="cal-split-panel">
          {selectedSchedule ? (
            <ScheduleEditor
              existing={selectedSchedule}
              defaultDayIso={null}
              onSaved={async () => {
                await refresh();
              }}
              onDeleted={async () => {
                setSelection(null);
                await refresh();
              }}
              onCancel={() => setSelection(null)}
            />
          ) : composeDayIso ? (
            <ScheduleEditor
              existing={null}
              defaultDayIso={composeDayIso}
              onSaved={async (s) => {
                setSelection({ kind: "schedule", id: s.id });
                await refresh();
              }}
              onDeleted={() => setSelection(null)}
              onCancel={() => setSelection(null)}
            />
          ) : selectedTodo ? (
            <TodoDetailPanel
              todo={selectedTodo}
              onToggled={async () => {
                await refresh();
              }}
              onNavigateToTodo={onNavigateToTodo}
              onClose={() => setSelection(null)}
            />
          ) : (
            <div className="cal-panel-empty">
              <p>왼쪽 캘린더에서 일정을 클릭하거나 날짜의 "+ 추가"를 눌러 새 일정을 만드세요.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
