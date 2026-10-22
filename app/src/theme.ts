/** 라이트/다크 테마 선택. 값은 localStorage 에 저장하고 <html data-theme> 로 적용한다 (색 값은 styles/tokens.css). */
export type ThemePref = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "wh.theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function systemPrefersDark(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(DARK_QUERY).matches;
}

export function getThemePref(): ThemePref {
  try {
    const v = window.localStorage.getItem(THEME_STORAGE_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function resolveTheme(pref: ThemePref): ResolvedTheme {
  if (pref === "system") return systemPrefersDark() ? "dark" : "light";
  return pref;
}

export function applyTheme(pref: ThemePref): void {
  document.documentElement.dataset.theme = resolveTheme(pref);
}

export function setThemePref(pref: ThemePref): void {
  try {
    if (pref === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // 저장 실패해도 현재 세션에는 적용한다
  }
  applyTheme(pref);
}

/**
 * 앱 시작 시 한 번 호출. 저장된 선택을 적용하고, OS 테마 변경·다른 창(빠른 캡처)의 변경을 따라간다.
 * index.html 의 인라인 스크립트가 첫 페인트 전에 같은 값을 미리 적용하므로 여기서는 보정만 한다.
 */
export function initTheme(): void {
  applyTheme(getThemePref());
  if (typeof window.matchMedia === "function") {
    window.matchMedia(DARK_QUERY).addEventListener("change", () => {
      if (getThemePref() === "system") applyTheme("system");
    });
  }
  window.addEventListener("storage", (e) => {
    if (e.key === THEME_STORAGE_KEY) applyTheme(getThemePref());
  });
}
