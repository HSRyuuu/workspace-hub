import { act, renderHook } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { formatRelative, useSaveIndicator } from "../../useSaveIndicator";

describe("formatRelative", () => {
  const NOW = new Date("2026-05-18T12:00:00Z").getTime();

  it("returns '방금' for < 30s", () => {
    expect(formatRelative(NOW - 5_000, NOW)).toBe("방금");
    expect(formatRelative(NOW - 29_000, NOW)).toBe("방금");
  });

  it("returns 'N분 전' for >= 30s and < 1h", () => {
    expect(formatRelative(NOW - 60_000, NOW)).toBe("1분 전");
    expect(formatRelative(NOW - 30 * 60_000, NOW)).toBe("30분 전");
    expect(formatRelative(NOW - 59 * 60_000, NOW)).toBe("59분 전");
  });

  it("returns 'N시간 전' for >= 1h", () => {
    expect(formatRelative(NOW - 60 * 60_000, NOW)).toBe("1시간 전");
    expect(formatRelative(NOW - 5 * 60 * 60_000, NOW)).toBe("5시간 전");
  });
});

describe("useSaveIndicator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-18T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts in idle state", () => {
    const { result } = renderHook(() => useSaveIndicator());
    expect(result.current.state).toBe("idle");
    expect(result.current.label).toBeNull();
  });

  it("markSaving -> 'saving' / '저장 중…'", () => {
    const { result } = renderHook(() => useSaveIndicator());
    act(() => result.current.markSaving());
    expect(result.current.state).toBe("saving");
    expect(result.current.label).toBe("저장 중…");
  });

  it("markSaved -> 'saved' / '저장됨 · 방금'", () => {
    const { result } = renderHook(() => useSaveIndicator());
    act(() => result.current.markSaved());
    expect(result.current.state).toBe("saved");
    expect(result.current.label).toBe("저장됨 · 방금");
  });

  it("reset -> 'idle'", () => {
    const { result } = renderHook(() => useSaveIndicator());
    act(() => result.current.markSaved());
    act(() => result.current.reset());
    expect(result.current.state).toBe("idle");
    expect(result.current.label).toBeNull();
  });
});
