import { act, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MemoPage from "../MemoPage";
import type { Memo } from "../types";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

vi.mock("../../../components/ui/MarkdownEditor", () => ({
  MarkdownEditor: ({
    initialMarkdown,
    onChange,
  }: {
    initialMarkdown: string;
    onChange?: (markdown: string) => void;
  }) => {
    useEffect(() => onChange?.(initialMarkdown), [initialMarkdown, onChange]);
    return <div data-testid="markdown-editor">{initialMarkdown}</div>;
  },
}));

vi.mock("../MemoActions", () => ({
  default: () => <div data-testid="memo-actions" />,
}));

function memo(id: number, title: string): Memo {
  return {
    id,
    folder_id: null,
    title,
    body: `${title} body`,
    pinned: false,
    deleted_at: null,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
  };
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("MemoPage selectedMemoId navigation", () => {
  beforeEach(() => {
    invokeMock.mockImplementation((command: string, args?: { scope?: string }) => {
      if (command === "memo_folder_list") return Promise.resolve([]);
      if (command === "memo_list" && args?.scope === "trash") return Promise.resolve([]);
      if (command === "memo_list") return Promise.resolve([memo(1, "First"), memo(2, "Target")]);
      if (command === "project_list") return Promise.resolve([]);
      if (command === "memo_project_list_projects") return Promise.resolve([]);
      return Promise.resolve(undefined);
    });
  });

  it("opens the requested active memo after the list loads", async () => {
    render(<MemoPage selectedMemoId={2} />);
    await flushPromises();

    expect(screen.getByDisplayValue("Target")).toBeInTheDocument();
    expect(screen.getByTestId("markdown-editor")).toHaveTextContent("Target body");
  });
});
