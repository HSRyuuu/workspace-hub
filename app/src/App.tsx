import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { ConfirmToast } from "./components/ui/ConfirmToast";
import { Toast } from "./components/ui/Toast";
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

const SECTIONS: { id: Section; label: string; enabled: boolean; Icon: () => JSX.Element }[] = [
  { id: "today", label: "Today", enabled: true, Icon: TodayIcon },
  { id: "todo", label: "TODO", enabled: true, Icon: TodoIcon },
  { id: "calendar", label: "Calendar", enabled: true, Icon: CalendarIcon },
  { id: "memos", label: "Memo", enabled: true, Icon: MemoIcon },
  { id: "files", label: "파일탐색기", enabled: true, Icon: FilesIcon },
];

export default function App() {
  const [section, setSection] = useState<Section>("today");
  const [selectedTodoId, setSelectedTodoId] = useState<number | null>(null);
  const [selectedMemoId, setSelectedMemoId] = useState<number | null>(null);
  const [calendarNonce, setCalendarNonce] = useState(0);

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
    <div className="app-shell">
      {/* App 루트 단일 마운트 — 어느 도메인에서도 showConfirmToast/showErrorToast 로 접근 */}
      <ConfirmToast />
      <Toast />
      <aside className="sidebar">
        {SECTIONS.map((s) => (
          <div
            key={s.id}
            className={[
              "sidebar-item",
              section === s.id ? "active" : "",
              s.enabled ? "" : "disabled",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => s.enabled && setSection(s.id)}
            role="button"
            aria-label={s.label}
            aria-disabled={!s.enabled}
          >
            <span className="sidebar-item-icon">
              <s.Icon />
            </span>
            <span className="sidebar-item-label" aria-hidden>
              {s.label}
            </span>
          </div>
        ))}
        {/* 설정은 도메인이 아니라 사이드바 맨 아래에 고정 */}
        <div
          className={`sidebar-item sidebar-item--bottom${section === "settings" ? " active" : ""}`}
          onClick={() => setSection("settings")}
          role="button"
          aria-label="설정"
        >
          <span className="sidebar-item-icon">
            <SettingsIcon />
          </span>
          <span className="sidebar-item-label" aria-hidden>
            설정
          </span>
        </div>
      </aside>
      <main
        className={`main${section === "memos" || section === "files" ? " main--flush" : ""}`}
      >
        {section === "today" && (
          <TodayPage
            onNavigateToTodo={(id) => {
              setSelectedTodoId(id);
              setSection("todo");
            }}
            onNavigateToMemo={(id) => {
              setSelectedMemoId(id);
              setSection("memos");
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
