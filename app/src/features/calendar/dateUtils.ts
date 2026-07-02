/** 캘린더 화면이 공유하는 날짜 유틸. 모든 입출력은 로컬 타임존 기준. */

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** `YYYY-MM-DD` (로컬) */
export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function fromIsoDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 로컬 기준 자정 Date → 같은 instant 의 UTC RFC3339 문자열 */
export function localDateTimeToUtcIso(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** 로컬 (year/month/day/hour/minute) → UTC RFC3339 (`...Z`) */
export function buildLocalIso(
  year: number,
  month1to12: number,
  day: number,
  hour: number,
  minute: number,
): string {
  const d = new Date(year, month1to12 - 1, day, hour, minute, 0, 0);
  return localDateTimeToUtcIso(d);
}

/** UTC RFC3339 → 로컬 Date */
export function parseUtcIso(s: string): Date {
  return new Date(s);
}

/** 월 그리드(6×7=42칸) — 첫 칸은 그 달 1일의 그 주 일요일 */
export function buildMonthGrid(
  year: number,
  month1to12: number,
): { y: number; m: number; d: number; outside: boolean; iso: string }[] {
  const first = new Date(year, month1to12 - 1, 1);
  const startWeekday = first.getDay();
  const cells: { y: number; m: number; d: number; outside: boolean; iso: string }[] = [];
  for (let i = 0; i < 42; i++) {
    const cur = new Date(year, month1to12 - 1, 1 - startWeekday + i);
    cells.push({
      y: cur.getFullYear(),
      m: cur.getMonth() + 1,
      d: cur.getDate(),
      outside: cur.getMonth() + 1 !== month1to12,
      iso: toIsoDate(cur),
    });
  }
  return cells;
}

/** 월 fetch 범위. [그리드 첫날, 다음달 1일) */
export function monthFetchRange(
  year: number,
  month1to12: number,
): { from: string; to: string } {
  const first = new Date(year, month1to12 - 1, 1);
  const startWeekday = first.getDay();
  const gridStart = new Date(year, month1to12 - 1, 1 - startWeekday);
  const next = new Date(year, month1to12, 1);
  return { from: toIsoDate(gridStart), to: toIsoDate(next) };
}

export function formatTimeLocal(utcIso: string): string {
  const d = parseUtcIso(utcIso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function formatDateLocal(utcIso: string): string {
  const d = parseUtcIso(utcIso);
  return toIsoDate(d);
}

/** 이 날짜 셀(로컬 YYYY-MM-DD)에 표시되어야 하는 스케줄인지. */
export function scheduleOverlapsDay(s: { start_at: string; end_at: string }, dayIso: string): boolean {
  const day = fromIsoDate(dayIso);
  if (!day) return false;
  const nextDay = new Date(day);
  nextDay.setDate(day.getDate() + 1);
  const start = parseUtcIso(s.start_at);
  const end = parseUtcIso(s.end_at);
  return start < nextDay && end >= day;
}

/** TODO 는 마감일이 있으면 마감일, 없으면 생성일의 로컬 날짜에 표시한다. */
export function todoCalendarDate(todo: { due_date: string | null; created_at: string }): string {
  return todo.due_date ?? formatDateLocal(todo.created_at);
}

export function todoFallsOnDay(
  todo: { due_date: string | null; created_at: string },
  dayIso: string,
): boolean {
  return todoCalendarDate(todo) === dayIso;
}

export function shiftMonth(year: number, month1to12: number, delta: number): {
  year: number;
  month: number;
} {
  const d = new Date(year, month1to12 - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function todayIso(): string {
  return toIsoDate(new Date());
}
