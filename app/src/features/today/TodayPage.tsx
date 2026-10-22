import { useEffect, useMemo, useState } from "react";
import { PriorityDot, showErrorToast } from "../../components/ui";
import { ChevronIcon } from "../../components/ui/icons";
import { scheduleApi } from "../calendar/api";
import {
  addDays,
  formatTimeLocal,
  fromIsoDate,
  parseUtcIso,
  scheduleOverlapsDay,
  todayIso,
} from "../calendar/dateUtils";
import type { Schedule } from "../calendar/types";
import { daysOverdue } from "../todo/dueLabel";
import type { Todo } from "../todo/types";
import { todayApi } from "./api";
import { elapsedDays } from "./dateUtils";
import type { DashboardSummary } from "./types";

interface TodayPageProps {
  onNavigateToTodo(id: number | null): void;
  onNavigateToCalendar?(): void;
}

const EMPTY_SUMMARY: DashboardSummary = {
  due_todos: [],
  open_todos: [],
  open_total: 0,
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
/** 앞으로 며칠을 "다가오는" 구간으로 볼지 (오늘 포함 7일) */
const UPCOMING_DAYS = 7;
const STALE_DAYS = 7;
const STRIP_LINES = 3;

function dateHeading(iso: string): { year: string; title: string } {
  const d = fromIsoDate(iso)!;
  return {
    year: `${d.getFullYear()}년`,
    title: `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAYS[d.getDay()]}요일`,
  };
}

function scheduleTime(s: Schedule): string {
  return s.all_day ? "종일" : formatTimeLocal(s.start_at);
}

function StatTile({
  label,
  value,
  sub,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  sub?: string;
  tone?: "danger" | "accent";
  onClick(): void;
}) {
  return (
    <button
      type="button"
      className={`dash-tile${tone ? ` dash-tile--${tone}` : ""}`}
      onClick={onClick}
      aria-label={`${label} ${value}건`}
    >
      <span className="dash-tile-label">{label}</span>
      <span className="dash-tile-value">{value}</span>
      <span className="dash-tile-sub">{sub ?? " "}</span>
    </button>
  );
}

function Card({
  id,
  title,
  count,
  children,
}: {
  id: string;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="today-card" aria-labelledby={id}>
      <div className="today-section-head">
        <h2 id={id}>{title}</h2>
        <span>{count}</span>
      </div>
      {children}
    </section>
  );
}

function TodoRow({
  todo,
  meta,
  metaTone,
  onClick,
}: {
  todo: Todo;
  meta: string;
  metaTone?: "danger";
  onClick(): void;
}) {
  return (
    <button
      type="button"
      className="today-row"
      aria-label={`${todo.title}, ${meta}`}
      onClick={onClick}
    >
      <PriorityDot priority={todo.priority} />
      <span className="today-row-title">{todo.title}</span>
      <span className={`today-row-meta${metaTone ? ` today-row-meta--${metaTone}` : ""}`}>
        {meta}
      </span>
      <ChevronIcon size={13} />
    </button>
  );
}

export default function TodayPage({ onNavigateToTodo, onNavigateToCalendar }: TodayPageProps) {
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const today = todayIso();
  const horizon = addDays(today, UPCOMING_DAYS - 1);

  // 호출 순서: 요약 → 일정 (요약이 항상 첫 invoke)
  useEffect(() => {
    todayApi
      .summary(horizon)
      .then(setSummary)
      .catch((error: unknown) => {
        setSummary(EMPTY_SUMMARY);
        showErrorToast(String(error));
      });
    scheduleApi
      .listRange(today, addDays(today, UPCOMING_DAYS))
      .then((list) =>
        setSchedules(
          (Array.isArray(list) ? list : []).sort((a, b) => a.start_at.localeCompare(b.start_at)),
        ),
      )
      .catch((error: unknown) => {
        setSchedules([]);
        showErrorToast(String(error));
      });
  }, [today, horizon]);

  const overdue = useMemo(
    () => summary.due_todos.filter((t) => t.due_date !== null && t.due_date < today),
    [summary.due_todos, today],
  );
  const dueToday = useMemo(
    () => summary.due_todos.filter((t) => t.due_date === today),
    [summary.due_todos, today],
  );
  const dueUpcoming = useMemo(
    () => summary.due_todos.filter((t) => t.due_date !== null && t.due_date > today),
    [summary.due_todos, today],
  );
  const stale = useMemo(
    () =>
      summary.open_todos
        .map((todo) => ({ todo, days: elapsedDays(todo.created_at, today) }))
        .filter((x) => x.days >= STALE_DAYS),
    [summary.open_todos, today],
  );
  const todaySchedules = useMemo(
    () => schedules.filter((s) => scheduleOverlapsDay(s, today)),
    [schedules, today],
  );
  const days = useMemo(
    () =>
      Array.from({ length: UPCOMING_DAYS }, (_, i) => {
        const iso = addDays(today, i);
        const d = fromIsoDate(iso)!;
        return {
          iso,
          weekday: WEEKDAYS[d.getDay()],
          date: d.getDate(),
          schedules: schedules.filter((s) => scheduleOverlapsDay(s, iso)),
          todos: summary.due_todos.filter((t) => t.due_date === iso),
        };
      }),
    [today, schedules, summary.due_todos],
  );

  const heading = dateHeading(today);
  const nextScheduleId = todaySchedules.find(
    (s) => !s.all_day && parseUtcIso(s.end_at) > new Date(),
  )?.id;
  const goCalendar = () => onNavigateToCalendar?.();

  return (
    <div className="today-page dash">
      <header className="today-header today-header--date">
        <p>{heading.year}</p>
        <h1>{heading.title}</h1>
      </header>

      <div className="dash-tiles">
        <StatTile
          label="지난 마감"
          value={overdue.length}
          sub={overdue.length > 0 ? "바로 확인이 필요해요" : "밀린 마감이 없어요"}
          tone={overdue.length > 0 ? "danger" : undefined}
          onClick={() => onNavigateToTodo(null)}
        />
        <StatTile
          label="오늘 마감"
          value={dueToday.length}
          sub={dueToday.length > 0 ? "오늘 안에 끝내기" : "오늘은 여유로워요"}
          onClick={() => onNavigateToTodo(null)}
        />
        <StatTile
          label="앞으로 7일 마감"
          value={dueUpcoming.length}
          sub="오늘 제외"
          onClick={() => onNavigateToTodo(null)}
        />
        <StatTile
          label="미완료 TODO"
          value={summary.open_total}
          sub={stale.length > 0 ? `오래된 것 ${stale.length}건+` : "정리가 잘 되고 있어요"}
          onClick={() => onNavigateToTodo(null)}
        />
      </div>

      <section className="dash-week" aria-label="다가오는 7일">
        {days.map((day, i) => {
          const lines: { key: string; className: string; text: string; color?: string }[] = [
            ...day.schedules.map((s) => ({
              key: `s${s.id}`,
              className: "dash-chip dash-chip--sched",
              text: `${scheduleTime(s)} ${s.title}`,
              color: s.color ?? "var(--color-data-blue)",
            })),
            ...day.todos.map((t) => ({
              key: `t${t.id}`,
              className: "dash-chip dash-chip--todo",
              text: t.title,
            })),
          ];
          const shown = lines.slice(0, STRIP_LINES);
          const rest = lines.length - shown.length;
          return (
            <button
              key={day.iso}
              type="button"
              className={`dash-day${i === 0 ? " today" : ""}`}
              aria-label={`${day.date}일 ${day.weekday}요일, 일정 ${day.schedules.length}건, 마감 ${day.todos.length}건`}
              onClick={goCalendar}
            >
              <span className="dash-day-head">
                <span className="dash-day-wd">{i === 0 ? "오늘" : day.weekday}</span>
                <span className="dash-day-num">{day.date}</span>
              </span>
              <span className="dash-day-items">
                {shown.map((l) => (
                  <span
                    key={l.key}
                    className={l.className}
                    style={l.color ? { ["--bar-color" as string]: l.color } : undefined}
                  >
                    {l.text}
                  </span>
                ))}
                {rest > 0 && <span className="dash-day-more">+{rest}</span>}
                {lines.length === 0 && <span className="dash-day-empty">—</span>}
              </span>
            </button>
          );
        })}
      </section>

      <div className="dash-grid">
        <div className="dash-col">
          <Card id="dash-sched" title="오늘 일정" count={todaySchedules.length}>
            {todaySchedules.length > 0 ? (
              <div className="today-list">
                {todaySchedules.map((s) => {
                  const isNext = s.id === nextScheduleId;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={`today-row${isNext ? " today-row--next" : ""}`}
                      aria-label={`${s.title}, ${scheduleTime(s)}`}
                      onClick={goCalendar}
                    >
                      <span className="today-row-meta today-sched-time">{scheduleTime(s)}</span>
                      <span
                        className="today-sched-bar"
                        style={{ ["--bar-color" as string]: s.color ?? "var(--color-data-blue)" }}
                      />
                      <span className="today-row-title">{s.title}</span>
                      {isNext && <span className="today-next-chip">다음</span>}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="today-empty">오늘 일정이 없어요.</p>
            )}
          </Card>

          <Card id="dash-today" title="오늘 마감" count={dueToday.length}>
            {dueToday.length > 0 ? (
              <div className="today-list">
                {dueToday.map((t) => (
                  <TodoRow key={t.id} todo={t} meta="오늘" onClick={() => onNavigateToTodo(t.id)} />
                ))}
              </div>
            ) : (
              <p className="today-empty">오늘 마감인 TODO가 없어요.</p>
            )}
          </Card>
        </div>

        <div className="dash-col">
          <Card id="dash-overdue" title="지난 마감" count={overdue.length}>
            {overdue.length > 0 ? (
              <div className="today-list">
                {overdue.map((t) => (
                  <TodoRow
                    key={t.id}
                    todo={t}
                    meta={`${daysOverdue(t.due_date!, today)}일 지남`}
                    metaTone="danger"
                    onClick={() => onNavigateToTodo(t.id)}
                  />
                ))}
              </div>
            ) : (
              <p className="today-empty">지난 마감이 없어요.</p>
            )}
          </Card>

          <Card id="dash-stale" title={`${STALE_DAYS}일 넘게 열린 TODO`} count={stale.length}>
            {stale.length > 0 ? (
              <div className="today-list">
                {stale.map(({ todo, days: elapsed }) => (
                  <TodoRow
                    key={todo.id}
                    todo={todo}
                    meta={`${elapsed}일 경과`}
                    onClick={() => onNavigateToTodo(todo.id)}
                  />
                ))}
              </div>
            ) : (
              <p className="today-empty">오래 묵은 TODO가 없어요.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
