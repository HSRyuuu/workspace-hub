import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TodayPage from "../TodayPage";
import type { DashboardSummary } from "../types";
import type { Todo } from "../../todo/types";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

function todo(overrides: Partial<Todo>): Todo {
  return {
    id: 1,
    workspace_id: null,
    title: "Todo",
    description: null,
    summary: null,
    links: [],
    start_date: "2026-07-01",
    due_date: null,
    due_time: 0,
    priority: "mid",
    status: "open",
    completed_at: null,
    created_at: new Date(2026, 6, 1).toISOString(),
    updated_at: new Date(2026, 6, 1).toISOString(),
    ...overrides,
  };
}

function summary(): DashboardSummary {
  return {
    due_todos: [
      todo({ id: 1, title: "Past due", due_date: "2026-07-07" }),
      todo({ id: 2, title: "Due today", due_date: "2026-07-08" }),
      todo({ id: 3, title: "Due this week", due_date: "2026-07-10" }),
      todo({ id: 4, title: "After week", due_date: "2026-07-13" }),
      todo({ id: 5, title: "No due date", due_date: null }),
    ],
    open_todos: [
      todo({
        id: 6,
        title: "Old open todo",
        created_at: new Date(2026, 5, 29).toISOString(),
      }),
    ],
    open_total: 2,
    recent_memos: [
      {
        id: 20,
        folder_id: null,
        title: "",
        body: "# Body title\ncontent",
        pinned: false,
        deleted_at: null,
        created_at: "2026-07-01T00:00:00Z",
        updated_at: "2026-07-08T00:00:00Z",
      },
    ],
    recent_folders: [
      {
        id: 30,
        path: "/Users/me/RecentFolder",
        is_favorite: false,
        last_opened_at: "2026-07-08T00:00:00Z",
      },
    ],
  };
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("TodayPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 8, 12));
    invokeMock.mockImplementation((command: string) => {
      if (command === "dashboard_summary") return Promise.resolve(summary());
      return Promise.resolve(undefined);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    invokeMock.mockReset();
  });

  it("groups deadlines and renders dashboard summaries", async () => {
    render(<TodayPage onNavigateToTodo={vi.fn()} onNavigateToMemo={vi.fn()} />);
    await flushPromises();

    const overdue = screen.getByText("Past due");
    expect(screen.getByRole("heading", { name: "지난 마감" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "오늘" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "이번 주" })).toBeInTheDocument();
    expect(overdue.closest(".today-due-overdue")).not.toBeNull();
    expect(screen.queryByText("After week")).not.toBeInTheDocument();
    expect(screen.queryByText("No due date")).not.toBeInTheDocument();

    const staleTodo = screen.getByText("Old open todo").closest(".today-row");
    expect(staleTodo).toHaveClass("today-row--stale");
    expect(screen.getByText("9일 경과")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1건 더" })).toBeInTheDocument();
    expect(screen.getByText("Body title")).toBeInTheDocument();
    expect(screen.getByText("RecentFolder")).toBeInTheDocument();
  });

  it("routes todo and memo clicks and opens folders without touching history", async () => {
    const onNavigateToTodo = vi.fn();
    const onNavigateToMemo = vi.fn();
    render(<TodayPage onNavigateToTodo={onNavigateToTodo} onNavigateToMemo={onNavigateToMemo} />);
    await flushPromises();
    screen.getByText("Past due");

    fireEvent.click(screen.getByRole("button", { name: /Past due/ }));
    fireEvent.click(screen.getByRole("button", { name: "1건 더" }));
    fireEvent.click(screen.getByRole("button", { name: /Body title/ }));
    fireEvent.click(screen.getByRole("button", { name: /RecentFolder/ }));

    expect(onNavigateToTodo).toHaveBeenCalledWith(1);
    expect(onNavigateToTodo).toHaveBeenCalledWith(null);
    expect(onNavigateToMemo).toHaveBeenCalledWith(20);
    expect(invokeMock).toHaveBeenCalledWith("open_in_finder", {
      path: "/Users/me/RecentFolder",
    });
    expect(invokeMock).not.toHaveBeenCalledWith("files_folder_touch", expect.anything());
  });

  it("shows section empty states", async () => {
    invokeMock.mockResolvedValueOnce({
      due_todos: [],
      open_todos: [],
      open_total: 0,
      recent_memos: [],
      recent_folders: [],
    });
    render(<TodayPage onNavigateToTodo={vi.fn()} onNavigateToMemo={vi.fn()} />);
    await flushPromises();

    expect(screen.getByText("마감된 TODO가 없습니다.")).toBeInTheDocument();
    expect(screen.getByText("미완료 TODO가 없습니다.")).toBeInTheDocument();
    expect(screen.getByText("최근 메모가 없습니다.")).toBeInTheDocument();
    expect(screen.getByText("최근 폴더가 없습니다.")).toBeInTheDocument();
  });
});
