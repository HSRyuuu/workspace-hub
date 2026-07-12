import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CaptureApp from "../CaptureApp";

const { invokeMock, hideMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  hideMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("@tauri-apps/api/webviewWindow", () => ({
  getCurrentWebviewWindow: () => ({ hide: hideMock }),
}));

describe("CaptureApp", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    hideMock.mockReset();
  });

  it("starts in memo mode", () => {
    render(<CaptureApp />);

    expect(screen.getByRole("button", { name: "메모" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "TODO" })).toHaveAttribute("aria-pressed", "false");
  });

  it("creates a memo and opens it in the main window on Enter", async () => {
    invokeMock.mockImplementation((command: string) => {
      if (command === "memo_add") return Promise.resolve({ id: 41 });
      return Promise.resolve();
    });
    render(<CaptureApp />);

    fireEvent.change(screen.getByRole("textbox", { name: "빠른 캡처" }), {
      target: { value: "회의 메모" },
    });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "빠른 캡처" }), { key: "Enter" });

    await waitFor(() => {
      expect(invokeMock).toHaveBeenNthCalledWith(1, "memo_add", {
        input: { title: "회의 메모", body: "" },
      });
      expect(invokeMock).toHaveBeenNthCalledWith(2, "quick_capture_open_main", {
        kind: "memo",
        id: 41,
      });
    });
  });

  it("creates a TODO and opens it in the main window on Enter", async () => {
    invokeMock.mockImplementation((command: string) => {
      if (command === "todo_add") return Promise.resolve({ id: 73 });
      return Promise.resolve();
    });
    render(<CaptureApp />);

    fireEvent.click(screen.getByRole("button", { name: "TODO" }));
    fireEvent.change(screen.getByRole("textbox", { name: "빠른 캡처" }), {
      target: { value: "보고서 제출" },
    });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "빠른 캡처" }), { key: "Enter" });

    await waitFor(() => {
      expect(invokeMock).toHaveBeenNthCalledWith(1, "todo_add", {
        input: { title: "보고서 제출" },
      });
      expect(invokeMock).toHaveBeenNthCalledWith(2, "quick_capture_open_main", {
        kind: "todo",
        id: 73,
      });
    });
  });

  it("ignores empty input on Enter", () => {
    render(<CaptureApp />);

    fireEvent.keyDown(screen.getByRole("textbox", { name: "빠른 캡처" }), { key: "Enter" });

    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("toggles memo and TODO mode with Tab", () => {
    render(<CaptureApp />);
    const input = screen.getByRole("textbox", { name: "빠른 캡처" });

    fireEvent.keyDown(input, { key: "Tab" });
    expect(screen.getByRole("button", { name: "TODO" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.keyDown(input, { key: "Tab" });
    expect(screen.getByRole("button", { name: "메모" })).toHaveAttribute("aria-pressed", "true");
  });

  it("retries navigation without creating a duplicate item", async () => {
    let navigationAttempts = 0;
    invokeMock.mockImplementation((command: string) => {
      if (command === "memo_add") return Promise.resolve({ id: 41 });
      if (command === "quick_capture_open_main" && navigationAttempts++ === 0) {
        return Promise.reject(new Error("capture hide failed"));
      }
      return Promise.resolve();
    });
    render(<CaptureApp />);
    const input = screen.getByRole("textbox", { name: "빠른 캡처" });

    fireEvent.change(input, { target: { value: "한 번만 생성" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await screen.findByText(/capture hide failed/);
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(invokeMock.mock.calls.filter(([command]) => command === "memo_add")).toHaveLength(1);
      expect(
        invokeMock.mock.calls.filter(([command]) => command === "quick_capture_open_main"),
      ).toHaveLength(2);
    });
  });

  it("hides without saving on Escape", () => {
    render(<CaptureApp />);

    fireEvent.change(screen.getByRole("textbox", { name: "빠른 캡처" }), {
      target: { value: "저장하지 않음" },
    });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "빠른 캡처" }), { key: "Escape" });

    expect(hideMock).toHaveBeenCalledOnce();
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
