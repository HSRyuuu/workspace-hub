import type { Todo } from "../todo/types";
import type { Schedule } from "./types";
import {
  buildMonthGrid,
  formatTimeLocal,
  scheduleOverlapsDay,
  todayIso,
  todoFallsOnDay,
} from "./dateUtils";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

type WeekCell = { y: number; m: number; d: number; outside: boolean; iso: string };

type RawBar =
  | { kind: "schedule"; schedule: Schedule; startCol: number; span: number; color: string }
  | { kind: "todo"; todo: Todo; startCol: number; span: number };

type WeekBar = RawBar & { slot: number };

function chunk7(cells: WeekCell[]): WeekCell[][] {
  const out: WeekCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
  return out;
}

function findScheduleSpanInWeek(
  week: WeekCell[],
  s: Schedule,
): { startCol: number; span: number } | null {
  let startCol = -1;
  let endCol = -1;
  for (let ci = 0; ci < 7; ci++) {
    if (scheduleOverlapsDay(s, week[ci].iso)) {
      if (startCol < 0) startCol = ci;
      endCol = ci;
    }
  }
  return startCol < 0 ? null : { startCol, span: endCol - startCol + 1 };
}

function findTodoColInWeek(week: WeekCell[], t: Todo): number | null {
  if (!t.due_at) return null;
  for (let ci = 0; ci < 7; ci++) {
    if (todoFallsOnDay(t.due_at, week[ci].iso)) return ci;
  }
  return null;
}

/** 같은 슬롯에 겹치지 않도록 greedy 할당. */
function buildWeekBars(
  week: WeekCell[],
  schedules: Schedule[],
  todos: Todo[],
): WeekBar[] {
  const raw: RawBar[] = [];
  for (const s of schedules) {
    const r = findScheduleSpanInWeek(week, s);
    if (r) {
      raw.push({
        kind: "schedule",
        schedule: s,
        startCol: r.startCol,
        span: r.span,
        color: s.color ?? "#5E6AD2",
      });
    }
  }
  for (const t of todos) {
    const col = findTodoColInWeek(week, t);
    if (col != null) raw.push({ kind: "todo", todo: t, startCol: col, span: 1 });
  }
  // 정렬: startCol asc → 긴 span 먼저 → schedule 우선
  raw.sort((a, b) => {
    if (a.startCol !== b.startCol) return a.startCol - b.startCol;
    if (a.span !== b.span) return b.span - a.span;
    return a.kind === "schedule" ? -1 : 1;
  });
  const slotEnd: number[] = []; // slotEnd[i] = 그 슬롯의 마지막 bar의 (startCol + span)
  return raw.map((bar) => {
    let slot = 0;
    while (slot < slotEnd.length && slotEnd[slot] > bar.startCol) slot++;
    slotEnd[slot] = bar.startCol + bar.span;
    return { ...bar, slot } as WeekBar;
  });
}

interface MonthGridProps {
  year: number;
  month: number;
  schedules: Schedule[];
  todos: Todo[];
  selected:
    | { kind: "schedule"; id: number }
    | { kind: "todo"; id: number }
    | { kind: "compose"; dayIso: string }
    | null;
  onSelectSchedule: (id: number) => void;
  onSelectTodo: (id: number) => void;
  onCompose: (dayIso: string) => void;
}

export function MonthGrid({
  year,
  month,
  schedules,
  todos,
  selected,
  onSelectSchedule,
  onSelectTodo,
  onCompose,
}: MonthGridProps) {
  const cells = buildMonthGrid(year, month);
  const weeks = chunk7(cells);
  const today = todayIso();

  return (
    <div className="cal-month">
      <div className="cal-weekdays">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={`cal-weekday ${i === 0 ? "sun" : ""} ${i === 6 ? "sat" : ""}`}
          >
            {w}
          </div>
        ))}
      </div>
      <div className="cal-weeks">
        {weeks.map((week, wi) => {
          const bars = buildWeekBars(week, schedules, todos);
          return (
            <div className="cal-week" key={wi}>
              {week.map((day, ci) => {
                const isComposeHere =
                  selected?.kind === "compose" && selected.dayIso === day.iso;
                return (
                  <div
                    key={day.iso}
                    className={[
                      "cal-day",
                      day.outside ? "outside" : "",
                      day.iso === today ? "today" : "",
                      ci === 0 ? "sun" : "",
                      ci === 6 ? "sat" : "",
                      isComposeHere ? "composing" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span className="cal-day-num">{day.d}</span>
                    <button
                      type="button"
                      className="cal-add-btn"
                      onClick={() => onCompose(day.iso)}
                      aria-label={`${day.y}년 ${day.m}월 ${day.d}일에 일정 추가`}
                    >
                      + 추가
                    </button>
                  </div>
                );
              })}
              <div className="cal-bars">
                {bars.map((bar, bi) => {
                  const startPct = (bar.startCol / 7) * 100;
                  const widthPct = (bar.span / 7) * 100;
                  const top = `calc(var(--cal-bar-top) + ${bar.slot} * var(--cal-bar-row))`;
                  if (bar.kind === "schedule") {
                    const isSelected =
                      selected?.kind === "schedule" &&
                      selected.id === bar.schedule.id;
                    return (
                      <button
                        key={`s-${bar.schedule.id}-${bi}`}
                        type="button"
                        className={`cal-bar schedule ${isSelected ? "selected" : ""}`}
                        style={
                          {
                            left: `${startPct}%`,
                            width: `${widthPct}%`,
                            top,
                            ["--bar-color" as string]: bar.color,
                          } as React.CSSProperties
                        }
                        onClick={() => onSelectSchedule(bar.schedule.id)}
                        title={bar.schedule.title}
                      >
                        <span className="cal-bar-dot" aria-hidden />
                        {!bar.schedule.all_day && (
                          <span className="cal-bar-time">
                            {formatTimeLocal(bar.schedule.start_at)}
                          </span>
                        )}
                        <span className="cal-bar-title">{bar.schedule.title}</span>
                      </button>
                    );
                  }
                  const isSelected =
                    selected?.kind === "todo" && selected.id === bar.todo.id;
                  return (
                    <button
                      key={`t-${bar.todo.id}-${bi}`}
                      type="button"
                      className={`cal-bar todo ${
                        bar.todo.status === "done" ? "done" : ""
                      } ${isSelected ? "selected" : ""}`}
                      style={{
                        left: `${startPct}%`,
                        width: `${widthPct}%`,
                        top,
                      }}
                      onClick={() => onSelectTodo(bar.todo.id)}
                      title={bar.todo.title}
                    >
                      <span className="cal-bar-todo-icon" aria-hidden>
                        {bar.todo.status === "done" ? "☑" : "☐"}
                      </span>
                      <span className="cal-bar-title">{bar.todo.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
