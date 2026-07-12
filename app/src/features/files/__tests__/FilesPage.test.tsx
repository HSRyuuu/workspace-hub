import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import FilesPage from "../FilesPage";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("../FileExplorerLayout", () => ({
  FileExplorerLayout: ({
    currentPath,
    currentFolder,
    onOpenFolder,
  }: {
    currentPath: string | null;
    currentFolder: unknown;
    onOpenFolder: (path: string) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onOpenFolder("/project/target/debug")}>
        노이즈 폴더 열기
      </button>
      <span data-testid="current-path">{currentPath ?? "none"}</span>
      <span data-testid="favorite-state">{currentFolder ? "persisted" : "transient"}</span>
    </div>
  ),
}));

describe("FilesPage folder history", () => {
  afterEach(() => {
    invokeMock.mockReset();
  });

  it("opens a noise path even when touch skips its history row", async () => {
    invokeMock.mockImplementation((command: string) => {
      if (command === "files_folder_list") return Promise.resolve([]);
      if (command === "files_folder_touch") return Promise.resolve(null);
      return Promise.resolve(undefined);
    });

    render(<FilesPage />);
    fireEvent.click(screen.getByRole("button", { name: "노이즈 폴더 열기" }));

    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent("/project/target/debug");
    });
    expect(screen.getByTestId("favorite-state")).toHaveTextContent("transient");
  });
});
