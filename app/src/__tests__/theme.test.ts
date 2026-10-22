import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyTheme, getThemePref, resolveTheme, setThemePref, THEME_STORAGE_KEY } from "../theme";

function mockSystemDark(dark: boolean) {
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: dark }) as unknown as typeof window.matchMedia;
}

describe("theme", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
  });
  afterEach(() => {
    // jsdom 에는 matchMedia 가 없으므로 기본 상태로 되돌린다
    delete (window as { matchMedia?: unknown }).matchMedia;
  });

  it("defaults to system and follows the OS setting", () => {
    expect(getThemePref()).toBe("system");
    mockSystemDark(true);
    expect(resolveTheme("system")).toBe("dark");
    mockSystemDark(false);
    expect(resolveTheme("system")).toBe("light");
  });

  it("falls back to light when matchMedia is unavailable", () => {
    expect(resolveTheme("system")).toBe("light");
  });

  it("explicit choices ignore the OS setting and are persisted", () => {
    mockSystemDark(true);
    setThemePref("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(getThemePref()).toBe("light");

    setThemePref("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("choosing system clears the stored value", () => {
    setThemePref("dark");
    mockSystemDark(false);
    setThemePref("system");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("ignores garbage in storage", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "purple");
    expect(getThemePref()).toBe("system");
    applyTheme(getThemePref());
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
