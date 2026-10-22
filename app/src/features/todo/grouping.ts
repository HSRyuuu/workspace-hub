import type { Todo } from "./types";

export type DueGroupKey = "overdue" | "today" | "week" | "later" | "none" | "done";

export interface DueGroup {
  key: DueGroupKey;
  label: string;
  todos: Todo[];
}

const GROUPS: { key: DueGroupKey; label: string }[] = [
  { key: "overdue", label: "지난 마감" },
  { key: "today", label: "오늘" },
  { key: "week", label: "이번 주" },
  { key: "later", label: "나중" },
  { key: "none", label: "기한 없음" },
  { key: "done", label: "완료" },
];

/**
 * 목록을 마감 시점별로 묶는다. 빈 그룹은 버린다.
 * 그룹 안은 마감일 오름차순(같으면 원래 순서), 완료한 항목은 마감과 무관하게 맨 아래 "완료" 그룹.
 * `today`·`weekEnd` 는 YYYY-MM-DD (weekEnd 는 이번 주 일요일까지 포함).
 */
export function groupTodosByDue(todos: Todo[], today: string, weekEnd: string): DueGroup[] {
  const buckets = new Map<DueGroupKey, Todo[]>(GROUPS.map((g) => [g.key, []]));
  for (const t of todos) {
    let key: DueGroupKey;
    if (t.status === "done") key = "done";
    else if (!t.due_date) key = "none";
    else if (t.due_date < today) key = "overdue";
    else if (t.due_date === today) key = "today";
    else if (t.due_date <= weekEnd) key = "week";
    else key = "later";
    buckets.get(key)!.push(t);
  }
  return GROUPS.map((g) => {
    const list = buckets.get(g.key)!;
    if (g.key !== "none" && g.key !== "done") {
      list.sort(
        (a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? "") || a.due_time - b.due_time,
      );
    }
    return { ...g, todos: list };
  }).filter((g) => g.todos.length > 0);
}
