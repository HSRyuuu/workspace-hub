import { fireEvent, render, screen, within } from "@testing-library/react";
import { forwardRef, useImperativeHandle } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TodoPage from "../TodoPage";
import type { Todo } from "../types";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

vi.mock("../../../components/ui/MarkdownEditor", () => ({
  MarkdownEditor: forwardRef(function MarkdownEditorMock(
    { initialMarkdown }: { initialMarkdown: string },
    ref,
  ) {
    useImperativeHandle(ref, () => ({ focus: vi.fn() }));
    return <div data-testid="markdown-editor">{initialMarkdown}</div>;
  }),
}));

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: 1,
    workspace_id: null,
    title: "Open todo",
    description: null,
    start_date: "2026-06-29",
    due_date: null,
    due_time: 0,
    priority: "mid",
    status: "open",
    completed_at: null,
    created_at: "2026-06-29T00:00:00Z",
    updated_at: "2026-06-29T00:00:00Z",
    ...overrides,
  };
}

describe("TodoPage filters", () => {
  beforeEach(() => {
    invokeMock.mockImplementation((command: string) => {
      if (command === "todo_list") {
        return Promise.resolve([
          makeTodo({ id: 1, title: "Open todo" }),
          makeTodo({
            id: 2,
            title: "Overdue open todo",
            due_date: "2000-01-01",
          }),
          makeTodo({
            id: 3,
            title: "Overdue done todo",
            due_date: "2000-01-01",
            status: "done",
            completed_at: "2000-01-01T01:00:00Z",
          }),
          makeTodo({
            id: 4,
            title: "Future open todo",
            due_date: "2999-01-01",
          }),
        ]);
      }
      return Promise.resolve(undefined);
    });
  });

  afterEach(() => {
    invokeMock.mockReset();
  });

  it("shows status filters in open, overdue, done, all order", async () => {
    render(<TodoPage />);
    await screen.findByText("Open todo");

    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "열림",
      "마감",
      "완료",
      "전체",
    ]);
  });

  it("filters overdue todos to open items with past due dates", async () => {
    render(<TodoPage />);
    await screen.findByText("Open todo");

    fireEvent.click(screen.getByRole("tab", { name: "마감" }));

    const list = screen.getByText("Overdue open todo").closest(".todo-list");
    expect(list).not.toBeNull();
    expect(within(list as HTMLElement).getByText("Overdue open todo")).toBeInTheDocument();
    expect(screen.queryByText("Open todo")).not.toBeInTheDocument();
    expect(screen.queryByText("Overdue done todo")).not.toBeInTheDocument();
    expect(screen.queryByText("Future open todo")).not.toBeInTheDocument();
  });
});
