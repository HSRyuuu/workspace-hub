import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Event } from "@tauri-apps/api/event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";

const { listenMock } = vi.hoisted(() => ({ listenMock: vi.fn() }));
let quickCaptureHandler:
  ((event: Event<{ kind: "memo" | "todo"; id: number }>) => void) | undefined;

vi.mock("@tauri-apps/api/event", () => ({ listen: listenMock }));

vi.mock("../features/today/TodayPage", () => ({
  default: ({
    onNavigateToTodo,
    onNavigateToMemo,
  }: {
    onNavigateToTodo(id: number | null): void;
    onNavigateToMemo(id: number): void;
  }) => (
    <div>
      <h1>Today dashboard</h1>
      <button onClick={() => onNavigateToTodo(42)}>Open todo 42</button>
      <button onClick={() => onNavigateToMemo(24)}>Open memo 24</button>
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

vi.mock("../features/calendar/CalendarPage", () => ({ default: () => <div>Calendar page</div> }));
vi.mock("../features/project/ProjectPage", () => ({ default: () => <div>Project page</div> }));
vi.mock("../features/files/FilesPage", () => ({ default: () => <div>Files page</div> }));

describe("App Today navigation", () => {
  beforeEach(() => {
    quickCaptureHandler = undefined;
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
      .map((button) => button.getAttribute("aria-label"));
    expect(destinations[0]).toBe("Today");
  });

  it("returns to Today from another section", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "TODO" }));
    expect(screen.getByText("Todo page selected none")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(screen.getByRole("heading", { name: "Today dashboard" })).toBeInTheDocument();
  });

  it("passes selected ids from Today into TODO and Memo pages", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Open todo 42" }));
    expect(screen.getByText("Todo page selected 42")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    fireEvent.click(screen.getByRole("button", { name: "Open memo 24" }));
    expect(screen.getByText("Memo page selected 24")).toBeInTheDocument();
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
});
