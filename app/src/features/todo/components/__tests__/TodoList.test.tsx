import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TodoList } from "../TodoList";
import type { Todo } from "../../types";

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

const writeText = vi.fn();

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: 1,
    workspace_id: null,
    title: "Reply to request",
    description: null,
    summary: null,
    links: [],
    start_date: "2026-10-21",
    due_date: null,
    due_time: 0,
    priority: "mid",
    status: "open",
    completed_at: null,
    created_at: "2026-10-21T00:00:00Z",
    updated_at: "2026-10-21T00:00:00Z",
    ...overrides,
  };
}

function renderList(todos: Todo[], onSelect = vi.fn()) {
  render(
    <TodoList
      todos={todos}
      selectedId={null}
      onSelect={onSelect}
      onToggle={vi.fn()}
      onDelete={vi.fn()}
    />,
  );
  return onSelect;
}

describe("TodoList summary and links", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(undefined);
    writeText.mockReset();
    writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  });

  it("renders summary and one chip per link", () => {
    renderList([
      makeTodo({
        summary: "다은 · POP 아고다 tag 이슈",
        links: ["https://tripbtoz.slack.com/archives/C1/p1", "https://tripbtoz.atlassian.net/browse/TASK-1"],
      }),
    ]);

    expect(screen.getByText("다은 · POP 아고다 tag 이슈")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "링크 열기" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "링크 복사" })).toHaveLength(2);
  });

  it("renders nothing extra for a todo without summary or links", () => {
    const { container } = render(
      <TodoList
        todos={[makeTodo()]}
        selectedId={null}
        onSelect={vi.fn()}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(container.querySelector(".todo-summary")).toBeNull();
    expect(container.querySelector(".todo-links")).toBeNull();
    expect(screen.queryByRole("button", { name: "링크 열기" })).toBeNull();
  });

  it("opens the link in the browser without selecting the row", () => {
    const onSelect = renderList([makeTodo({ links: ["https://a.example/x"] })]);

    fireEvent.click(screen.getByRole("button", { name: "링크 열기" }));

    expect(invokeMock).toHaveBeenCalledWith("open_url", { url: "https://a.example/x" });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("copies the link without selecting the row", () => {
    const onSelect = renderList([makeTodo({ links: ["https://a.example/x"] })]);

    fireEvent.click(screen.getByRole("button", { name: "링크 복사" }));

    expect(writeText).toHaveBeenCalledWith("https://a.example/x");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("still selects the row when the title area is clicked", () => {
    const onSelect = renderList([makeTodo({ summary: "s", links: ["https://a.example/x"] })]);

    fireEvent.click(screen.getByText("Reply to request"));

    expect(onSelect).toHaveBeenCalledWith(1);
  });
});
