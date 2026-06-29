import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MemoPage from "../MemoPage";
import type { Memo } from "../types";

const invokeMock = vi.hoisted(() => vi.fn());
const editorInitialChangeMock = vi.hoisted(() => vi.fn((markdown: string) => markdown));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

vi.mock("../../../components/ui/MarkdownEditor", () => ({
  MarkdownEditor: ({
    initialMarkdown,
    onChange,
  }: {
    initialMarkdown: string;
    onChange?: (markdown: string) => void;
  }) => {
    useEffect(() => {
      onChange?.(editorInitialChangeMock(initialMarkdown));
    }, [initialMarkdown, onChange]);

    return <div data-testid="markdown-editor">{initialMarkdown}</div>;
  },
}));

vi.mock("../MemoActions", () => ({
  default: () => <div data-testid="memo-actions" />,
}));

function makeMemo(overrides: Partial<Memo> = {}): Memo {
  return {
    id: 1,
    folder_id: null,
    title: "Existing title",
    body: "Existing body",
    pinned: false,
    deleted_at: null,
    created_at: "2026-06-29T00:00:00Z",
    updated_at: "2026-06-29T00:00:00Z",
    ...overrides,
  };
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("MemoPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    editorInitialChangeMock.mockImplementation((markdown: string) => markdown);
    invokeMock.mockImplementation((command: string) => {
      if (command === "memo_folder_list") return Promise.resolve([]);
      if (command === "memo_list") return Promise.resolve([makeMemo()]);
      if (command === "project_list") return Promise.resolve([]);
      if (command === "memo_project_list_projects") return Promise.resolve([]);
      if (command === "memo_update") return Promise.resolve(makeMemo());
      return Promise.resolve(undefined);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    editorInitialChangeMock.mockReset();
    invokeMock.mockReset();
  });

  it("does not save a memo when opening its detail and leaving it unchanged", async () => {
    render(<MemoPage />);
    await flushPromises();

    fireEvent.click(screen.getByRole("button", { name: /Existing title/ }));
    await flushPromises();
    screen.getByDisplayValue("Existing title");

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    fireEvent.click(screen.getByLabelText("목록으로"));

    expect(invokeMock).not.toHaveBeenCalledWith(
      "memo_update",
      expect.objectContaining({ id: 1 }),
    );
  });

  it("does not send a blank title when the editor reports a normalized body on open", async () => {
    editorInitialChangeMock.mockImplementation((markdown: string) => `${markdown}\n`);

    render(<MemoPage />);
    await flushPromises();

    fireEvent.click(screen.getByRole("button", { name: /Existing title/ }));
    await flushPromises();
    screen.getByDisplayValue("Existing title");

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(invokeMock).not.toHaveBeenCalledWith(
      "memo_update",
      expect.objectContaining({
        id: 1,
        patch: expect.objectContaining({ title: "" }),
      }),
    );
  });
});
