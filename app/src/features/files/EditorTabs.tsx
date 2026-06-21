import { useRef, useState } from "react";
import { useOutsideClick } from "../../components/ui/useOutsideClick";

interface TabItem {
  path: string;
  name: string;
  dirty: boolean;
}

interface EditorTabsProps {
  tabs: TabItem[];
  activePath: string | null;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
  /** 여러 탭을 한 번에 닫는다 — 다른 탭/오른쪽 탭/모두 닫기에 사용. */
  onCloseMany: (paths: string[]) => void;
}

type TabMenu = { x: number; y: number; path: string } | null;

export function EditorTabs({ tabs, activePath, onSelect, onClose, onCloseMany }: EditorTabsProps) {
  const [menu, setMenu] = useState<TabMenu>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  useOutsideClick(menuRef, menu !== null, () => setMenu(null));

  if (tabs.length === 0) return null;

  const menuIdx = menu ? tabs.findIndex((t) => t.path === menu.path) : -1;
  const hasOthers = tabs.length > 1;
  const hasRight = menuIdx >= 0 && menuIdx < tabs.length - 1;

  const runMenu = (paths: string[]) => {
    setMenu(null);
    if (paths.length > 0) onCloseMany(paths);
  };

  return (
    <div className="files-tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.path}
          type="button"
          role="tab"
          aria-selected={t.path === activePath}
          className={`files-tab${t.path === activePath ? " active" : ""}`}
          title={t.path}
          onClick={() => onSelect(t.path)}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenu({ x: e.clientX, y: e.clientY, path: t.path });
          }}
        >
          <span className="files-tab-name">{t.name}</span>
          {t.dirty && <span className="files-tab-dirty" aria-label="unsaved" />}
          <span
            role="button"
            tabIndex={0}
            className="files-tab-close"
            aria-label={`close ${t.name}`}
            onClick={(e) => {
              e.stopPropagation();
              onClose(t.path);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onClose(t.path);
              }
            }}
          >
            ×
          </span>
        </button>
      ))}
      {menu && (
        <div ref={menuRef} className="files-ctxmenu" style={{ top: menu.y, left: menu.x }}>
          <button type="button" onClick={() => runMenu([menu.path])}>
            닫기
          </button>
          <button
            type="button"
            disabled={!hasOthers}
            onClick={() => runMenu(tabs.filter((t) => t.path !== menu.path).map((t) => t.path))}
          >
            다른 탭 닫기
          </button>
          <button
            type="button"
            disabled={!hasRight}
            onClick={() => runMenu(tabs.slice(menuIdx + 1).map((t) => t.path))}
          >
            오른쪽 탭 닫기
          </button>
          <button type="button" onClick={() => runMenu(tabs.map((t) => t.path))}>
            모두 닫기
          </button>
        </div>
      )}
    </div>
  );
}
