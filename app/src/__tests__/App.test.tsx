import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Event } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";

const { listenMock } = vi.hoisted(() => ({ listenMock: vi.fn() }));
type QuickCaptureKind = "memo" | "todo" | "schedule";
let quickCaptureHandler:
  ((event: Event<{ kind: QuickCaptureKind; id: number }>) => void) | undefined;

vi.mock("@tauri-apps/api/event", () => ({ listen: listenMock }));

vi.mock("../features/today/TodayPage", () => ({
  default: ({ onNavigateToTodo }: { onNavigateToTodo(id: number | null): void }) => (
    <div>
      <h1>Today dashboard</h1>
      <button onClick={() => onNavigateToTodo(42)}>Open todo 42</button>
    </div>
  ),
}));

vi.mock("../features/todo/TodoPage", () => ({
  default: ({ selectedTodoId }: { selectedTodoId?: number | null }) => (
    <div>Todo page selected {selectedTodoId ?? "none"}</div>
  ),
}));

vi.mock("../features/memo/MemoPage", () => ({
  default: ({ selectedMemoId }: { selectedMemoId?: number | null }) => (
    <div>Memo page selected {selectedMemoId ?? "none"}</div>
  ),
}));

let calendarMounts = 0;
vi.mock("../features/calendar/CalendarPage", () => ({
  default: function CalendarPageMock() {
    // 마운트마다 refresh() 가 도는 구조라, 재마운트 횟수가 refetch 횟수다.
    useEffect(() => {
      calendarMounts += 1;
    }, []);
    return <div>Calendar page</div>;
  },
}));
vi.mock("../features/files/FilesPage", () => ({ default: () => <div>Files page</div> }));

describe("App Today navigation", () => {
  beforeEach(() => {
    quickCaptureHandler = undefined;
    calendarMounts = 0;
    listenMock.mockReset();
    listenMock.mockImplementation((_event: string, handler: typeof quickCaptureHandler) => {
      quickCaptureHandler = handler;
      return Promise.resolve(() => undefined);
    });
  });

  it("starts on Today and exposes it as the first sidebar destination", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Today dashboard" })).toBeInTheDocument();
    expect(screen.queryByText(/Todo page selected/)).not.toBeInTheDocument();
    const destinations = screen
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label"))
      .filter((label) => label !== "검색");
    expect(destinations[0]).toBe("Today");
  });

  it("returns to Today from another section", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "TODO" }));
    expect(screen.getByText("Todo page selected none")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(screen.getByRole("heading", { name: "Today dashboard" })).toBeInTheDocument();
  });

  it("passes the selected id from Today into the TODO page", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Open todo 42" }));
    expect(screen.getByText("Todo page selected 42")).toBeInTheDocument();
  });

  it("opens the captured item when the Tauri navigation event arrives", async () => {
    render(<App />);

    await waitFor(() =>
      expect(listenMock).toHaveBeenCalledWith("quick-capture:navigate", expect.any(Function)),
    );
    act(() =>
      quickCaptureHandler?.({ payload: { kind: "todo", id: 73 } } as Event<{
        kind: "todo";
        id: number;
      }>),
    );
    expect(screen.getByText("Todo page selected 73")).toBeInTheDocument();

    act(() =>
      quickCaptureHandler?.({ payload: { kind: "memo", id: 41 } } as Event<{
        kind: "memo";
        id: number;
      }>),
    );
    expect(screen.getByText("Memo page selected 41")).toBeInTheDocument();
  });

  it("switches to the calendar when a captured schedule arrives", async () => {
    render(<App />);

    await waitFor(() =>
      expect(listenMock).toHaveBeenCalledWith("quick-capture:navigate", expect.any(Function)),
    );
    act(() =>
      quickCaptureHandler?.({ payload: { kind: "schedule", id: 7 } } as Event<{
        kind: QuickCaptureKind;
        id: number;
      }>),
    );

    expect(screen.getByText("Calendar page")).toBeInTheDocument();
  });

  it("refetches the calendar when a schedule arrives while already on the calendar", async () => {
    render(<App />);

    await waitFor(() =>
      expect(listenMock).toHaveBeenCalledWith("quick-capture:navigate", expect.any(Function)),
    );
    fireEvent.click(screen.getByRole("button", { name: "Calendar" }));
    expect(calendarMounts).toBe(1);

    // 이미 캘린더 섹션이라 setSection 은 no-op — nonce 가 없으면 재마운트되지 않아 새 일정이 안 보인다.
    act(() =>
      quickCaptureHandler?.({ payload: { kind: "schedule", id: 7 } } as Event<{
        kind: QuickCaptureKind;
        id: number;
      }>),
    );

    expect(calendarMounts).toBe(2);
  });
});
