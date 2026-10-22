import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TodayPage from "../TodayPage";
import type { DashboardSummary } from "../types";
import type { Schedule } from "../../calendar/types";
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

function schedule(overrides: Partial<Schedule>): Schedule {
  return {
    id: 1,
    title: "Schedule",
    description: null,
    location: null,
    start_at: new Date(2026, 6, 8, 14).toISOString(),
    end_at: new Date(2026, 6, 8, 15).toISOString(),
    all_day: false,
    color: null,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

function summary(): DashboardSummary {
  return {
    due_todos: [
      todo({ id: 1, title: "Past due", due_date: "2026-07-07" }),
      todo({ id: 2, title: "Due today", due_date: "2026-07-08" }),
      todo({ id: 3, title: "Due this week", due_date: "2026-07-10" }),
    ],
    open_todos: [
      todo({
        id: 6,
        title: "Old open todo",
        created_at: new Date(2026, 5, 29).toISOString(),
      }),
      todo({ id: 7, title: "Fresh open todo", created_at: new Date(2026, 6, 7).toISOString() }),
    ],
    open_total: 9,
  };
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function renderPage(props: Partial<React.ComponentProps<typeof TodayPage>> = {}) {
  const onNavigateToTodo = vi.fn();
  const onNavigateToCalendar = vi.fn();
  render(
    <TodayPage
      onNavigateToTodo={onNavigateToTodo}
      onNavigateToCalendar={onNavigateToCalendar}
      {...props}
    />,
  );
  return { onNavigateToTodo, onNavigateToCalendar };
}

describe("TodayPage dashboard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 8, 12));
    invokeMock.mockImplementation((command: string) => {
      if (command === "dashboard_summary") return Promise.resolve(summary());
      if (command === "schedule_list_range")
        return Promise.resolve([schedule({ id: 10, title: "Standup" })]);
      return Promise.resolve(undefined);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    invokeMock.mockReset();
  });

  it("asks for a 7-day horizon and renders the date header with counts", async () => {
    renderPage();
    await flushPromises();

    expect(invokeMock).toHaveBeenCalledWith("dashboard_summary", { weekEnd: "2026-07-14" });
    expect(screen.getByRole("heading", { level: 1, name: "7월 8일 수요일" })).toBeInTheDocument();
  });

  it("shows stat tiles with the counts", async () => {
    renderPage();
    await flushPromises();

    expect(screen.getByRole("button", { name: "지난 마감 1건" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "오늘 마감 1건" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "앞으로 7일 마감 1건" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "미완료 TODO 9건" })).toBeInTheDocument();
  });

  it("lists overdue, today, and stale todos and today's schedule in their cards", async () => {
    renderPage();
    await flushPromises();

    const overdue = screen.getByRole("region", { name: "지난 마감" });
    expect(within(overdue).getByText("Past due")).toBeInTheDocument();
    expect(within(overdue).getByText("1일 지남")).toBeInTheDocument();

    const dueToday = screen.getByRole("region", { name: "오늘 마감" });
    expect(within(dueToday).getByText("Due today")).toBeInTheDocument();

    const stale = screen.getByRole("region", { name: "7일 넘게 열린 TODO" });
    expect(within(stale).getByText("Old open todo")).toBeInTheDocument();
    expect(within(stale).getByText("9일 경과")).toBeInTheDocument();
    expect(within(stale).queryByText("Fresh open todo")).not.toBeInTheDocument();

    const sched = screen.getByRole("region", { name: "오늘 일정" });
    expect(within(sched).getByText("Standup")).toBeInTheDocument();
    expect(within(sched).getByText("다음")).toBeInTheDocument();
  });

  it("no longer shows recent memos or folders", async () => {
    renderPage();
    await flushPromises();

    expect(screen.queryByText("최근 메모")).not.toBeInTheDocument();
    expect(screen.queryByText("최근 폴더")).not.toBeInTheDocument();
  });

  it("renders a 7-day strip starting today with that day's items", async () => {
    renderPage();
    await flushPromises();

    const strip = screen.getByRole("region", { name: "다가오는 7일" });
    const days = within(strip).getAllByRole("button");
    expect(days).toHaveLength(7);
    expect(days[0]).toHaveAccessibleName("8일 수요일, 일정 1건, 마감 1건");
    expect(days[0]).toHaveTextContent("오늘");
    expect(days[2]).toHaveAccessibleName("10일 금요일, 일정 0건, 마감 1건");
    expect(within(days[2]).getByText("Due this week")).toBeInTheDocument();
  });

  it("routes todo rows, tiles, and calendar-bound items", async () => {
    const { onNavigateToTodo, onNavigateToCalendar } = renderPage();
    await flushPromises();

    fireEvent.click(screen.getByRole("button", { name: /Past due/ }));
    fireEvent.click(screen.getByRole("button", { name: "미완료 TODO 9건" }));
    fireEvent.click(screen.getByRole("button", { name: /Standup/ }));

    expect(onNavigateToTodo).toHaveBeenCalledWith(1);
    expect(onNavigateToTodo).toHaveBeenCalledWith(null);
    expect(onNavigateToCalendar).toHaveBeenCalledTimes(1);
  });

  it("shows friendly empty states", async () => {
    invokeMock.mockImplementation((command: string) =>
      Promise.resolve(
        command === "dashboard_summary"
          ? {
              due_todos: [],
              open_todos: [],
              open_total: 0,
            }
          : [],
      ),
    );
    renderPage();
    await flushPromises();

    expect(screen.getByText("오늘 일정이 없어요.")).toBeInTheDocument();
    expect(screen.getByText("오늘 마감인 TODO가 없어요.")).toBeInTheDocument();
    expect(screen.getByText("지난 마감이 없어요.")).toBeInTheDocument();
    expect(screen.getByText("오래 묵은 TODO가 없어요.")).toBeInTheDocument();
  });
});
