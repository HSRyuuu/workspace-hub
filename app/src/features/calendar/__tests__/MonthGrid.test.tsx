import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Todo } from "../../todo/types";
import type { Schedule } from "../types";
import { MonthGrid } from "../MonthGrid";

function makeSchedule(
  id: number,
  title: string,
  start_at: string,
  end_at: string,
): Schedule {
  return {
    id,
    title,
    description: null,
    location: null,
    start_at,
    end_at,
    all_day: false,
    color: null,
    created_at: `2026-05-01T00:00:0${id}Z`,
    updated_at: `2026-05-01T00:00:0${id}Z`,
  };
}

function makeTodo(overrides: Partial<Todo>): Todo {
  return {
    id: 1,
    workspace_id: null,
    title: "Todo",
    description: null,
    start_date: "2026-05-01",
    due_date: null,
    due_time: 0,
    priority: "mid",
    status: "open",
    completed_at: null,
    created_at: "2026-05-03T00:00:00Z",
    updated_at: "2026-05-03T00:00:00Z",
    ...overrides,
  };
}

function renderMonthGrid(schedules: Schedule[], todos: Todo[] = []) {
  return render(
    <MonthGrid
      year={2026}
      month={5}
      schedules={schedules}
      todos={todos}
      selected={null}
      onSelectSchedule={vi.fn()}
      onSelectTodo={vi.fn()}
      onCompose={vi.fn()}
    />,
  );
}

function scheduleTitles(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll<HTMLButtonElement>(".cal-bar.schedule"))
    .map((button) => button.title)
    .filter(Boolean);
}

describe("MonthGrid schedule ordering", () => {
  it("orders schedules by start time before duration", () => {
    const early = makeSchedule(
      1,
      "09:00",
      "2026-05-20T09:00:00Z",
      "2026-05-20T10:00:00Z",
    );
    const late = makeSchedule(
      2,
      "15:00",
      "2026-05-20T15:00:00Z",
      "2026-05-22T16:00:00Z",
    );

    const { container } = renderMonthGrid([early, late]);

    expect(scheduleTitles(container)).toEqual(["09:00", "15:00"]);
  });

  it("orders multi-day schedules by later end date first", () => {
    const endsLater = makeSchedule(
      1,
      "ends later",
      "2026-05-17T09:00:00Z",
      "2026-05-30T18:00:00Z",
    );
    const endsEarlier = makeSchedule(
      2,
      "ends earlier",
      "2026-05-17T09:00:00Z",
      "2026-05-25T18:00:00Z",
    );

    const { container } = renderMonthGrid([endsLater, endsEarlier]);

    expect(scheduleTitles(container).slice(0, 2)).toEqual(["ends later", "ends earlier"]);
  });

  it("orders overlapping multi-day schedules by end date before start date", () => {
    const startsEarlierEndsEarlier = makeSchedule(
      1,
      "starts earlier",
      "2026-04-20T09:00:00Z",
      "2026-05-25T18:00:00Z",
    );
    const startsLaterEndsLater = makeSchedule(
      2,
      "ends later",
      "2026-04-22T09:00:00Z",
      "2026-05-30T18:00:00Z",
    );

    const { container } = renderMonthGrid([startsEarlierEndsEarlier, startsLaterEndsLater]);

    expect(scheduleTitles(container).slice(0, 2)).toEqual(["ends later", "starts earlier"]);
  });
});

describe("MonthGrid todo display date", () => {
  it("shows todos without due_date on their created date", () => {
    const { container } = renderMonthGrid([], [
      makeTodo({ id: 1, title: "Created only", created_at: "2026-05-03T00:00:00Z" }),
    ]);

    const bar = container.querySelector<HTMLButtonElement>(".cal-bar.todo");
    expect(bar?.title).toBe("Created only");
    expect(bar?.style.left).toBe("0%");
  });

  it("uses due_date instead of created date when both exist", () => {
    const { container } = renderMonthGrid([], [
      makeTodo({
        id: 1,
        title: "Due wins",
        created_at: "2026-05-03T00:00:00Z",
        due_date: "2026-05-20",
      }),
    ]);

    const bar = container.querySelector<HTMLButtonElement>(".cal-bar.todo");
    expect(bar?.title).toBe("Due wins");
    expect(bar?.style.left).toBe("42.857142857142854%");
  });
});
