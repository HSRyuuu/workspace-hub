import { formatDateLocal, formatTimeLocal } from "../calendar/dateUtils";
import type { Schedule } from "../calendar/types";
import { memoBodyPreview, memoDisplayTitle } from "../memo/markdown";
import type { Memo } from "../memo/types";
import type { Todo } from "../todo/types";

export type SearchKind = "todo" | "memo" | "schedule";

export interface SearchHit {
  kind: SearchKind;
  id: number;
  title: string;
  /** 오른쪽에 흐리게 붙는 부가 정보 (마감일 · 수정 미리보기 · 일정 시각) */
  meta: string;
}

export interface SearchSource {
  todos: Todo[];
  memos: Memo[];
  schedules: Schedule[];
}

export const SEARCH_KIND_LABEL: Record<SearchKind, string> = {
  todo: "TODO",
  memo: "메모",
  schedule: "일정",
};

/** 종류별 최대 `limit` 건. 제목이 맞는 항목을 본문(요약·설명·장소)만 맞는 항목보다 먼저 둔다. */
export function searchAll(query: string, source: SearchSource, limit = 5): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const has = (text: string | null | undefined) => (text ?? "").toLowerCase().includes(q);

  const rank = <T>(items: T[], title: (t: T) => string, other: (t: T) => (string | null)[]) => {
    const byTitle = items.filter((t) => has(title(t)));
    const byBody = items.filter((t) => !has(title(t)) && other(t).some(has));
    return [...byTitle, ...byBody].slice(0, limit);
  };

  const todos = rank(
    source.todos,
    (t) => t.title,
    (t) => [t.summary, t.description],
  ).map<SearchHit>((t) => ({
    kind: "todo",
    id: t.id,
    title: t.title,
    meta: t.status === "done" ? "완료" : (t.due_date ?? "기한 없음"),
  }));

  const memos = rank(source.memos, memoDisplayTitle, (m) => [m.body]).map<SearchHit>((m) => ({
    kind: "memo",
    id: m.id,
    title: memoDisplayTitle(m),
    meta: memoBodyPreview(m),
  }));

  const schedules = rank(
    source.schedules,
    (s) => s.title,
    (s) => [s.description, s.location],
  ).map<SearchHit>((s) => ({
    kind: "schedule",
    id: s.id,
    title: s.title,
    meta: s.all_day
      ? formatDateLocal(s.start_at)
      : `${formatDateLocal(s.start_at)} ${formatTimeLocal(s.start_at)}`,
  }));

  return [...todos, ...memos, ...schedules];
}
