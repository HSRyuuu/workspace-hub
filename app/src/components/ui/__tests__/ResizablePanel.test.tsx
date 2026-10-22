import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ResizablePanel } from "../ResizablePanel";

function renderPanel(onClose = vi.fn()) {
  render(
    <div>
      <ResizablePanel title="할 일 상세" onClose={onClose}>
        <button type="button">내용</button>
      </ResizablePanel>
    </div>,
  );
  return { onClose, panel: screen.getByRole("complementary", { name: "할 일 상세" }) };
}

describe("ResizablePanel", () => {
  it("starts at the default width every time it mounts", () => {
    const { panel } = renderPanel();
    expect(panel.style.width).toBe("460px");
  });

  it("resizes with the keyboard from the separator and never below the minimum", () => {
    const { panel } = renderPanel();
    const handle = screen.getByRole("separator", { name: "할 일 상세 폭 조절" });

    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(panel.style.width).toBe("484px");

    for (let i = 0; i < 30; i++) fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(panel.style.width).toBe("320px");
  });

  it("closes from the close button and from Escape while focus is inside", () => {
    const { onClose } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    screen.getByRole("button", { name: "내용" }).focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("lets an open dropdown consume Escape instead of closing the panel", () => {
    const { onClose } = renderPanel();
    const popover = document.createElement("ul");
    popover.className = "ws-select-popover";
    document.body.appendChild(popover);

    screen.getByRole("button", { name: "내용" }).focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    popover.remove();
  });
});
