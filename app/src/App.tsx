import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { ConfirmToast } from "./components/ui/ConfirmToast";
import { Toast } from "./components/ui/Toast";
import { CommandPalette } from "./features/search/CommandPalette";
import type { SearchHit } from "./features/search/search";
import { todoApi } from "./features/todo/api";
import TodoPage from "./features/todo/TodoPage";
import CalendarPage from "./features/calendar/CalendarPage";
import MemoPage from "./features/memo/MemoPage";
import FilesPage from "./features/files/FilesPage";
import TodayPage from "./features/today/TodayPage";
import SettingsPage from "./features/settings/SettingsPage";

type Section = "today" | "todo" | "calendar" | "memos" | "files" | "settings";
type QuickCaptureNavigation = { kind: "memo" | "todo" | "schedule"; id: number };

const ICON_SIZE = 18;
const iconProps = {
  width: ICON_SIZE,
  height: ICON_SIZE,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const TodayIcon = () => (
  <svg {...iconProps} aria-hidden>
    <circle cx="12" cy="12" r="3.5" />
    <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
  </svg>
);
const TodoIcon = () => (
  <svg {...iconProps} aria-hidden>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="M8 12.5l2.8 2.8L16 9.5" />
  </svg>
);
const CalendarIcon = () => (
  <svg {...iconProps} aria-hidden>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 9h18M8 3v4M16 3v4" />
  </svg>
);
const MemoIcon = () => (
  <svg {...iconProps} aria-hidden>
    <rect x="4" y="4" width="16" height="16" rx="2.5" />
    <path d="M8 9.5h8M8 13h8M8 16.5h5" />
  </svg>
);
const FilesIcon = () => (
  <svg {...iconProps} aria-hidden>
    <path d="M3.5 7.5v11A1.5 1.5 0 0 0 5 20h14a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 19 8h-7.2L9.6 5.7A1.5 1.5 0 0 0 8.5 5H5a1.5 1.5 0 0 0-1.5 1.5z" />
  </svg>
);

const SettingsIcon = () => (
  <svg {...iconProps} aria-hidden>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const SearchIcon = () => (
  <svg {...iconProps} aria-hidden>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4.2-4.2" />
  </svg>
);
const CollapseIcon = () => (
  <svg {...iconProps} aria-hidden>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <path d="M9.5 4.5v15" />
  </svg>
);

// 사이드바 순서 = ⌘1~5 단축키 순서
const SECTIONS: { id: Exclude<Section, "settings">; label: string; Icon: () => JSX.Element }[] = [
  { id: "today", label: "Today", Icon: TodayIcon },
  { id: "todo", label: "TODO", Icon: TodoIcon },
  { id: "calendar", label: "Calendar", Icon: CalendarIcon },
  { id: "memos", label: "Memo", Icon: MemoIcon },
  { id: "files", label: "파일탐색기", Icon: FilesIcon },
];

const SIDEBAR_COLLAPSED_KEY = "wh.sidebar.collapsed";

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export default function App() {
  const [section, setSection] = useState<Section>("today");
  const [selectedTodoId, setSelectedTodoId] = useState<number | null>(null);
  const [selectedMemoId, setSelectedMemoId] = useState<number | null>(null);
  const [calendarNonce, setCalendarNonce] = useState(0);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [openTodoCount, setOpenTodoCount] = useState<number | null>(null);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, prev ? "0" : "1");
      } catch {
        // 저장 실패해도 현재 세션에는 적용한다
      }
      return !prev;
    });
  }, []);

  // 사이드바 TODO 배지 — 화면을 옮길 때마다 갱신 (로컬 호출이라 가볍다)
  useEffect(() => {
    todoApi
      .list("open")
      .then((list) => setOpenTodoCount(Array.isArray(list) ? list.length : null))
      .catch(() => undefined);
  }, [section]);

  // ⌘1~5 화면 이동 · ⌘, 설정 · ⌘K 검색 · ⌘\ 사이드바 접기. ⌥/⇧ 조합은 에디터 단축키(⌘⌥1~9 등)라 건드리지 않는다.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.metaKey || e.altKey || e.shiftKey || e.ctrlKey) return;
      const index = Number(e.key) - 1;
      if (index >= 0 && index < SECTIONS.length) {
        e.preventDefault();
        setSection(SECTIONS[index].id);
      } else if (e.key === ",") {
        e.preventDefault();
        setSection("settings");
      } else if (e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      } else if (e.key === "\\") {
        e.preventDefault();
        toggleCollapsed();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleCollapsed]);

  const openHit = (hit: SearchHit) => {
    if (hit.kind === "todo") {
      setSelectedTodoId(hit.id);
      setSection("todo");
    } else if (hit.kind === "memo") {
      setSelectedMemoId(hit.id);
      setSection("memos");
    } else {
      setCalendarNonce((n) => n + 1);
      setSection("calendar");
    }
  };

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;

    void listen<QuickCaptureNavigation>("quick-capture:navigate", ({ payload }) => {
      if (payload.kind === "memo") {
        setSelectedMemoId(payload.id);
        setSection("memos");
      } else if (payload.kind === "schedule") {
        // CalendarPage 는 조건부 렌더라 이미 캘린더에 있으면 setSection 이 no-op 이 되어 refetch 가 안 된다.
        // nonce 를 key 로 넘겨 캡처마다 재마운트시킨다.
        setCalendarNonce((n) => n + 1);
        setSection("calendar");
      } else {
        setSelectedTodoId(payload.id);
        setSection("todo");
      }
    }).then((stopListening) => {
      if (disposed) stopListening();
      else unlisten = stopListening;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  return (
    <div className={`app-shell${collapsed ? " app-shell--collapsed" : ""}`}>
      {/* App 루트 단일 마운트 — 어느 도메인에서도 showConfirmToast/showErrorToast 로 접근 */}
      <ConfirmToast />
      <Toast />
      {paletteOpen && (
        <CommandPalette
          navItems={SECTIONS.map((s, i) => ({ id: s.id, label: s.label, shortcut: `⌘${i + 1}` }))}
          onClose={() => setPaletteOpen(false)}
          onNavigate={(id) => setSection(id as Section)}
          onOpenHit={openHit}
        />
      )}
      <aside className="sidebar" aria-label="주요 메뉴">
        <button
          type="button"
          className="sidebar-search"
          aria-label="검색"
          title="검색 (⌘K)"
          onClick={() => setPaletteOpen(true)}
        >
          <span className="sidebar-item-icon">
            <SearchIcon />
          </span>
          <span className="sidebar-item-label">검색</span>
          <kbd className="sidebar-kbd">⌘K</kbd>
        </button>
        {SECTIONS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={`sidebar-item${section === s.id ? " active" : ""}`}
            aria-label={s.label}
            aria-current={section === s.id ? "page" : undefined}
            title={`${s.label} (⌘${i + 1})`}
            onClick={() => setSection(s.id)}
          >
            <span className="sidebar-item-icon">
              <s.Icon />
            </span>
            <span className="sidebar-item-label">{s.label}</span>
            {s.id === "todo" && openTodoCount !== null && openTodoCount > 0 && (
              <span className="sidebar-count" aria-hidden>
                {openTodoCount}
              </span>
            )}
          </button>
        ))}
        {/* 설정·접기는 도메인이 아니라 사이드바 맨 아래에 고정 */}
        <button
          type="button"
          className={`sidebar-item sidebar-item--bottom${section === "settings" ? " active" : ""}`}
          aria-label="설정"
          aria-current={section === "settings" ? "page" : undefined}
          title="설정 (⌘,)"
          onClick={() => setSection("settings")}
        >
          <span className="sidebar-item-icon">
            <SettingsIcon />
          </span>
          <span className="sidebar-item-label">설정</span>
        </button>
        <button
          type="button"
          className="sidebar-item"
          aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
          title="사이드바 접기/펼치기 (⌘\)"
          onClick={toggleCollapsed}
        >
          <span className="sidebar-item-icon">
            <CollapseIcon />
          </span>
          <span className="sidebar-item-label">접기</span>
        </button>
      </aside>
      <main className={`main${section === "memos" || section === "files" ? " main--flush" : ""}`}>
        {section === "today" && (
          <TodayPage
            onNavigateToCalendar={() => {
              setCalendarNonce((n) => n + 1);
              setSection("calendar");
            }}
            onNavigateToTodo={(id) => {
              setSelectedTodoId(id);
              setSection("todo");
            }}
          />
        )}
        {section === "todo" && <TodoPage selectedTodoId={selectedTodoId} />}
        {section === "calendar" && (
          <CalendarPage
            key={calendarNonce}
            onNavigateToTodo={(id) => {
              setSelectedTodoId(id);
              setSection("todo");
            }}
          />
        )}
        {section === "memos" && <MemoPage selectedMemoId={selectedMemoId} />}
        {section === "files" && <FilesPage />}
        {section === "settings" && <SettingsPage />}
      </main>
    </div>
  );
}
