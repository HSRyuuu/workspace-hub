import { describe, expect, it } from "vitest";
import { elapsedDays, weekEndIso } from "../dateUtils";

describe("weekEndIso", () => {
  it.each([
    ["2026-07-08", "2026-07-12"],
    ["2026-07-12", "2026-07-12"],
    ["2026-07-06", "2026-07-12"],
  ])("maps %s to its Monday-Sunday week end", (input, expected) => {
    expect(weekEndIso(input)).toBe(expected);
  });
});

describe("elapsedDays", () => {
  it("compares the local calendar date of a UTC timestamp", () => {
    const createdAt = new Date(2026, 6, 2, 0, 0, 0).toISOString();
    expect(elapsedDays(createdAt, "2026-07-12")).toBe(10);
  });
});
