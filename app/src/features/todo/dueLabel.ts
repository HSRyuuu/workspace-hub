import { fromIsoDate } from "../calendar/dateUtils";

const DAY_MS = 24 * 60 * 60 * 1000;

/** `due` 가 `today` 보다 며칠 전인지 (오늘이거나 미래면 0). */
export function daysOverdue(due: string, today: string): number {
  const dueDate = fromIsoDate(due);
  const todayDate = fromIsoDate(today);
  if (!dueDate || !todayDate || dueDate >= todayDate) return 0;
  return Math.round((todayDate.getTime() - dueDate.getTime()) / DAY_MS);
}

/** 마감일 표시 — 오늘은 "오늘", 지난 미완료는 "N일 지남", 나머지는 날짜 그대로. */
export function formatDueShort(due: string | null, status: string, today: string): string {
  if (!due) return "";
  if (status === "done") return due;
  if (due === today) return "오늘";
  const overdue = daysOverdue(due, today);
  return overdue > 0 ? `${overdue}일 지남` : due;
}
