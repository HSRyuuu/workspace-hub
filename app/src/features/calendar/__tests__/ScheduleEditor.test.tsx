import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ScheduleEditor } from "../ScheduleEditor";
import type { Schedule } from "../types";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

function renderNewScheduleEditor() {
  render(
    <ScheduleEditor
      existing={null}
      defaultDayIso="2026-06-16"
      onSaved={vi.fn()}
      onDeleted={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
}

function localIso(year: number, month1to12: number, day: number, hour: number): string {
  return new Date(year, month1to12 - 1, day, hour, 0, 0, 0).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function makeSchedule(): Schedule {
  return {
    id: 1,
    title: "Existing schedule",
    start_at: localIso(2026, 6, 16, 9),
    end_at: localIso(2026, 6, 16, 10),
    all_day: false,
    description: null,
    location: null,
    color: null,
    created_at: "2026-06-16T00:00:00Z",
    updated_at: "2026-06-16T00:00:00Z",
  };
}

function pickHour(fieldLabel: string, hour: string) {
  fireEvent.click(screen.getByRole("button", { name: fieldLabel }));
  const dialog = screen.getByRole("dialog", { name: "시간 선택" });
  fireEvent.click(within(dialog).getByText(hour));
  fireEvent.click(within(dialog).getByRole("button", { name: "확인" }));
}

describe("ScheduleEditor date range sync", () => {
  it("moves the default end time to one hour after a changed start time", () => {
    renderNewScheduleEditor();

    pickHour("시작 시간", "11");

    expect(screen.getByRole("button", { name: "시작 시간" })).toHaveTextContent("11:00");
    expect(screen.getByRole("button", { name: "종료 시간" })).toHaveTextContent("12:00");
  });

  it("keeps a manually edited end time when the start time changes later", () => {
    renderNewScheduleEditor();

    pickHour("종료 시간", "13");
    pickHour("시작 시간", "11");

    expect(screen.getByRole("button", { name: "시작 시간" })).toHaveTextContent("11:00");
    expect(screen.getByRole("button", { name: "종료 시간" })).toHaveTextContent("13:00");
  });

  it("moves the end date forward when the adjusted end time crosses midnight", () => {
    renderNewScheduleEditor();

    pickHour("시작 시간", "23");

    expect(screen.getByRole("button", { name: "종료 날짜" })).toHaveTextContent("2026-06-17");
    expect(screen.getByRole("button", { name: "종료 시간" })).toHaveTextContent("00:00");
  });

  it("does not change the end time automatically while editing an existing schedule", () => {
    render(
      <ScheduleEditor
        existing={makeSchedule()}
        defaultDayIso={null}
        onSaved={vi.fn()}
        onDeleted={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    pickHour("시작 시간", "11");

    expect(screen.getByRole("button", { name: "시작 시간" })).toHaveTextContent("11:00");
    expect(screen.getByRole("button", { name: "종료 시간" })).toHaveTextContent("10:00");
  });
});

describe("ScheduleEditor save feedback", () => {
  it("holds a disabled 저장완료 button for one second after a successful save", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockResolvedValue(makeSchedule());
    vi.useFakeTimers();
    try {
      render(
        <ScheduleEditor
          existing={makeSchedule()}
          defaultDayIso={null}
          onSaved={vi.fn()}
          onDeleted={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "저장" }));
      // save() 는 async 이므로 fake timer 아래에서 microtask 를 직접 flush 해야 한다.
      await act(async () => {});

      expect(screen.getByRole("button", { name: "저장완료" })).toBeDisabled();

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.getByRole("button", { name: "저장" })).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });
});
