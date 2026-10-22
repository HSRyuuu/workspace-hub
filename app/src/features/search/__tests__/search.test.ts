import { describe, expect, it } from "vitest";
import type { Schedule } from "../../calendar/types";
import type { Memo } from "../../memo/types";
import type { Todo } from "../../todo/types";
import { searchAll } from "../search";

const todo = (id: number, title: string, extra: Partial<Todo> = {}): Todo => ({
  id,
  workspace_id: null,
  title,
  description: null,
  summary: null,
  links: [],
  start_date: "2026-10-01",
  due_date: null,
  due_time: 0,
  priority: "mid",
  status: "open",
  completed_at: null,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
  ...extra,
});

const memo = (id: number, title: string, body = ""): Memo => ({
  id,
  folder_id: null,
  title,
  body,
  pinned: false,
  deleted_at: null,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
});

const schedule = (id: number, title: string): Schedule => ({
  id,
  title,
  description: null,
  location: null,
  start_at: "2026-10-21T05:00:00Z",
  end_at: "2026-10-21T06:00:00Z",
  all_day: false,
  color: null,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
});

describe("searchAll", () => {
  const source = {
    todos: [
      todo(1, "마크다운 파서 초안", { due_date: "2026-10-23" }),
      todo(2, "장보기", { summary: "마크다운 책 구매" }),
    ],
    memos: [memo(1, "마크다운 파서 아이디어"), memo(2, "회의록", "본문에 마크다운 언급")],
    schedules: [schedule(1, "마크다운 데모 리허설"), schedule(2, "DDD 스터디")],
  };

  it("returns nothing for a blank query", () => {
    expect(searchAll("  ", source)).toEqual([]);
  });

  it("matches case-insensitively across kinds, grouped todo → memo → schedule", () => {
    const hits = searchAll("마크다운", source);
    expect(hits.map((h) => `${h.kind}:${h.id}`)).toEqual([
      "todo:1",
      "todo:2",
      "memo:1",
      "memo:2",
      "schedule:1",
    ]);
    expect(searchAll("ddd", source).map((h) => h.title)).toEqual(["DDD 스터디"]);
  });

  it("ranks title matches before body-only matches", () => {
    const hits = searchAll("마크다운", {
      todos: [todo(1, "장보기", { summary: "마크다운" }), todo(2, "마크다운 읽기")],
      memos: [],
      schedules: [],
    });
    expect(hits.map((h) => h.id)).toEqual([2, 1]);
  });

  it("caps each kind at the limit", () => {
    const many = Array.from({ length: 9 }, (_, i) => todo(i + 1, `할 일 ${i}`));
    expect(searchAll("할 일", { todos: many, memos: [], schedules: [] }, 3)).toHaveLength(3);
  });

  it("describes todos by due date state", () => {
    const hits = searchAll("a", {
      todos: [todo(1, "a1", { status: "done" }), todo(2, "a2")],
      memos: [],
      schedules: [],
    });
    expect(hits.map((h) => h.meta)).toEqual(["완료", "기한 없음"]);
  });
});
