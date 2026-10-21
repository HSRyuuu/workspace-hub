import { fireEvent, render, screen, within } from "@testing-library/react";
import { forwardRef, useImperativeHandle } from "react";
import { describe, expect, it, vi } from "vitest";
import { TodoDetail } from "../TodoDetail";
import type { Todo } from "../../types";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

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
    summary: null,
    links: [],
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
    render(<TodoDetail todo={makeTodo()} descriptionRef={{ current: null }} onPatch={vi.fn()} />);

    expect(screen.getByLabelText("시작일")).toHaveTextContent("2026-07-02");
    expect(screen.getByLabelText("마감일")).toHaveTextContent("2026-07-05");
    expect(screen.getByLabelText("마감 시간")).toHaveTextContent("09:30");
    expect(screen.getByText("생성일").closest(".detail-field")).toHaveTextContent("2026-07-02");
    expect(screen.getByText(/2026-07-03/)).toBeInTheDocument();
  });

  it("patches due_time as minutes from the time selector", () => {
    const onPatch = vi.fn();
    render(<TodoDetail todo={makeTodo()} descriptionRef={{ current: null }} onPatch={onPatch} />);

    fireEvent.click(screen.getByLabelText("마감 시간"));
    fireEvent.click(within(screen.getByLabelText("시")).getByText("10"));

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

  it("patches hold status immediately", () => {
    const onPatch = vi.fn();
    render(<TodoDetail todo={makeTodo()} descriptionRef={{ current: null }} onPatch={onPatch} />);

    fireEvent.click(screen.getByLabelText("상태"));
    fireEvent.click(screen.getByRole("option", { name: "보류" }));

    expect(onPatch).toHaveBeenCalledWith(1, { status: "hold" }, false);
  });

  describe("summary and links", () => {
    it("debounces summary typing and clears it as null", () => {
      const onPatch = vi.fn();
      render(<TodoDetail todo={makeTodo()} descriptionRef={{ current: null }} onPatch={onPatch} />);

      fireEvent.change(screen.getByLabelText("요약"), { target: { value: "맥락 한 줄" } });
      expect(onPatch).toHaveBeenLastCalledWith(1, { summary: "맥락 한 줄" }, true);

      fireEvent.change(screen.getByLabelText("요약"), { target: { value: "" } });
      expect(onPatch).toHaveBeenLastCalledWith(1, { summary: null }, true);
    });

    it("flushes a changed summary immediately on blur, but not when unchanged", () => {
      const onPatch = vi.fn();
      render(
        <TodoDetail
          todo={makeTodo({ summary: "old" })}
          descriptionRef={{ current: null }}
          onPatch={onPatch}
        />,
      );
      const input = screen.getByLabelText("요약");

      fireEvent.blur(input);
      expect(onPatch).not.toHaveBeenCalled();

      fireEvent.change(input, { target: { value: "new" } });
      onPatch.mockClear();
      fireEvent.blur(input);
      expect(onPatch).toHaveBeenCalledWith(1, { summary: "new" }, false);
    });

    it("adds a link chip by Enter, appending to the existing links", () => {
      const onPatch = vi.fn();
      render(
        <TodoDetail
          todo={makeTodo({ links: ["https://a.example"] })}
          descriptionRef={{ current: null }}
          onPatch={onPatch}
        />,
      );

      const input = screen.getByLabelText("링크 URL");
      fireEvent.change(input, { target: { value: "  https://b.example  " } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(onPatch).toHaveBeenCalledWith(
        1,
        { links: ["https://a.example", "https://b.example"] },
        false,
      );
      expect(input).toHaveValue("");
    });

    it("rejects a non-http link and tells the user", () => {
      const onPatch = vi.fn();
      render(<TodoDetail todo={makeTodo()} descriptionRef={{ current: null }} onPatch={onPatch} />);

      fireEvent.change(screen.getByLabelText("링크 URL"), { target: { value: "ftp://x" } });
      fireEvent.click(screen.getByRole("button", { name: "링크 추가" }));

      expect(onPatch).not.toHaveBeenCalled();
      expect(screen.getByRole("alert")).toHaveTextContent("http");
    });

    it("removes one chip and keeps the rest", () => {
      const onPatch = vi.fn();
      render(
        <TodoDetail
          todo={makeTodo({ links: ["https://a.example", "https://b.example"] })}
          descriptionRef={{ current: null }}
          onPatch={onPatch}
        />,
      );

      fireEvent.click(screen.getAllByRole("button", { name: "링크 삭제" })[0]);

      expect(onPatch).toHaveBeenCalledWith(1, { links: ["https://b.example"] }, false);
    });

    it("opens a detail chip in the browser", () => {
      invokeMock.mockResolvedValue(undefined);
      render(
        <TodoDetail
          todo={makeTodo({ links: ["https://a.example"] })}
          descriptionRef={{ current: null }}
          onPatch={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "링크 열기" }));

      expect(invokeMock).toHaveBeenCalledWith("open_url", { url: "https://a.example" });
    });
  });
});
