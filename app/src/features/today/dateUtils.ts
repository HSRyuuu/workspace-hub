import { fromIsoDate, parseUtcIso, toIsoDate } from "../calendar/dateUtils";

const DAY_MS = 24 * 60 * 60 * 1000;

export function weekEndIso(today: string): string {
  const date = fromIsoDate(today);
  if (!date) throw new Error(`invalid date: ${today}`);
  const daysUntilSunday = (7 - date.getDay()) % 7;
  date.setDate(date.getDate() + daysUntilSunday);
  return toIsoDate(date);
}

export function elapsedDays(createdAtUtcIso: string, today: string): number {
  const todayDate = fromIsoDate(today);
  if (!todayDate) throw new Error(`invalid date: ${today}`);
  const created = parseUtcIso(createdAtUtcIso);
  const todayDay = Date.UTC(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
  const createdDay = Date.UTC(created.getFullYear(), created.getMonth(), created.getDate());
  return Math.max(0, Math.floor((todayDay - createdDay) / DAY_MS));
}
