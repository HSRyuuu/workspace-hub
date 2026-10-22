import { describe, expect, it } from "vitest";
import { groupTodosByDue } from "../grouping";
import type { Todo } from "../types";

function todo(id: number, overrides: Partial<Todo> = {}): Todo {
  return {
    id,
    workspace_id: null,
    title: `t${id}`,
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
    ...overrides,
  };
}

describe("groupTodosByDue", () => {
  const today = "2026-10-21";
  const weekEnd = "2026-10-25";

  it("buckets by due date and drops empty groups", () => {
    const groups = groupTodosByDue(
      [
        todo(1, { due_date: "2026-10-30" }),
        todo(2, { due_date: "2026-10-15" }),
        todo(3),
        todo(4, { due_date: "2026-10-21" }),
        todo(5, { due_date: "2026-10-25" }),
      ],
      today,
      weekEnd,
    );
    expect(groups.map((g) => [g.key, g.todos.map((t) => t.id)])).toEqual([
      ["overdue", [2]],
      ["today", [4]],
      ["week", [5]],
      ["later", [1]],
      ["none", [3]],
    ]);
  });

  it("puts done todos in the last group regardless of due date", () => {
    const groups = groupTodosByDue(
      [todo(1, { status: "done", due_date: "2026-10-01" }), todo(2, { due_date: "2026-10-22" })],
      today,
      weekEnd,
    );
    expect(groups.map((g) => g.key)).toEqual(["week", "done"]);
  });

  it("sorts each dated group by due date then time, keeping order for undated", () => {
    const groups = groupTodosByDue(
      [
        todo(1, { due_date: "2026-10-23", due_time: 600 }),
        todo(2, { due_date: "2026-10-22" }),
        todo(3, { due_date: "2026-10-23", due_time: 60 }),
        todo(4),
        todo(5),
      ],
      today,
      weekEnd,
    );
    expect(groups[0].todos.map((t) => t.id)).toEqual([2, 3, 1]);
    expect(groups[1].todos.map((t) => t.id)).toEqual([4, 5]);
  });

  it("treats held todos like open ones", () => {
    const groups = groupTodosByDue(
      [todo(1, { status: "hold", due_date: "2026-10-01" })],
      today,
      weekEnd,
    );
    expect(groups[0].key).toBe("overdue");
  });
});
