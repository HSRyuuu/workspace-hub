import { useState } from "react";
import { ConfirmToast } from "./components/ui/ConfirmToast";
import { Toast } from "./components/ui/Toast";
import TodoPage from "./features/todo/TodoPage";
import CalendarPage from "./features/calendar/CalendarPage";
import MemoPage from "./features/memo/MemoPage";
import ProjectPage from "./features/project/ProjectPage";

type Section = "todo" | "calendar" | "memos" | "project";

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
const ProjectIcon = () => (
  <svg {...iconProps} aria-hidden>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
  </svg>
);

const SECTIONS: { id: Section; label: string; enabled: boolean; Icon: () => JSX.Element }[] = [
  { id: "todo", label: "TODO", enabled: true, Icon: TodoIcon },
  { id: "calendar", label: "Calendar", enabled: true, Icon: CalendarIcon },
  { id: "memos", label: "Memo", enabled: true, Icon: MemoIcon },
  { id: "project", label: "Workspace", enabled: true, Icon: ProjectIcon },
];

export default function App() {
  const [section, setSection] = useState<Section>("todo");

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
            <span className="sidebar-item-icon"><s.Icon /></span>
            <span className="sidebar-item-label" aria-hidden>{s.label}</span>
          </div>
        ))}
      </aside>
      <main className={`main${section === "memos" || section === "project" ? " main--flush" : ""}`}>
        {section === "todo" && <TodoPage />}
        {section === "calendar" && <CalendarPage onNavigateToTodo={() => setSection("todo")} />}
        {section === "memos" && <MemoPage />}
        {section === "project" && <ProjectPage />}
      </main>
    </div>
  );
}
