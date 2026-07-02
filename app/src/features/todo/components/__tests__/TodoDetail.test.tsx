import { fireEvent, render, screen } from "@testing-library/react";
import { forwardRef, useImperativeHandle } from "react";
import { describe, expect, it, vi } from "vitest";
import { TodoDetail } from "../TodoDetail";
import type { Todo } from "../../types";

vi.mock("../../../../components/ui/MarkdownEditor", () => ({
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
    title: "Write migration",
    description: "memo",
    start_date: "2026-07-02",
    due_date: "2026-07-05",
    due_time: 570,
    priority: "mid",
    status: "open",
    completed_at: "2026-07-03T04:05:00Z",
    created_at: "2026-07-02T01:02:00Z",
    updated_at: "2026-07-02T01:02:00Z",
    ...overrides,
  };
}

describe("TodoDetail", () => {
  it("shows start, due, due time, created, and completed fields", () => {
    render(
      <TodoDetail
        todo={makeTodo()}
        descriptionRef={{ current: null }}
        onPatch={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("시작일")).toHaveTextContent("2026-07-02");
    expect(screen.getByLabelText("마감일")).toHaveTextContent("2026-07-05");
    expect(screen.getByLabelText("마감 시간")).toHaveTextContent("09:30");
    expect(screen.getByText("2026-07-02")).toBeInTheDocument();
    expect(screen.getByText(/2026-07-03/)).toBeInTheDocument();
  });

  it("patches due_time as minutes from the time selector", () => {
    const onPatch = vi.fn();
    render(
      <TodoDetail
        todo={makeTodo()}
        descriptionRef={{ current: null }}
        onPatch={onPatch}
      />,
    );

    fireEvent.click(screen.getByLabelText("마감 시간"));
    fireEvent.click(screen.getByText("10"));

    expect(onPatch).toHaveBeenCalledWith(1, { due_time: 630 }, false);
  });

  it("keeps due time read-only when due_date is empty", () => {
    render(
      <TodoDetail
        todo={makeTodo({ due_date: null, due_time: 0 })}
        descriptionRef={{ current: null }}
        onPatch={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("마감 시간")).toBeDisabled();
  });
});
