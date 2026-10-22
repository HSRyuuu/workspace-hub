import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MonthPicker } from "../MonthPicker";

function setup() {
  const onSelect = vi.fn();
  render(<MonthPicker year={2026} month={10} onSelect={onSelect} />);
  return onSelect;
}

describe("MonthPicker", () => {
  it("shows the current cursor and opens a year/month dialog", () => {
    setup();
    const trigger = screen.getByRole("button", { name: /2026년 10월/ });
    expect(screen.queryByRole("dialog", { name: "연·월 선택" })).toBeNull();

    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "연·월 선택" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "10월" })).toHaveAttribute("aria-pressed", "true");
  });

  it("selects a month in another year and closes", () => {
    const onSelect = setup();
    fireEvent.click(screen.getByRole("button", { name: /2026년 10월/ }));
    fireEvent.click(screen.getByRole("button", { name: "다음 해" }));
    expect(screen.getByText("2027년")).toBeInTheDocument();
    // 다른 해에서는 같은 달 번호가 선택 표시되지 않는다
    expect(screen.getByRole("button", { name: "10월" })).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByRole("button", { name: "3월" }));
    expect(onSelect).toHaveBeenCalledWith(2027, 3);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("starts from the viewed year each time it opens and closes on Escape", () => {
    setup();
    const trigger = screen.getByRole("button", { name: /2026년 10월/ });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "이전 해" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(trigger);
    expect(screen.getByText("2026년")).toBeInTheDocument();
  });
});
