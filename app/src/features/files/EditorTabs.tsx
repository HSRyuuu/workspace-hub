import { useRef, useState } from "react";
import { showErrorToast, showHintToast } from "../../components/ui/Toast";
import { useOutsideClick } from "../../components/ui/useOutsideClick";
import { filesShellApi } from "./api";

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
  /** 해당 파일을 왼쪽 파일 트리에서 펼쳐 보여준다. */
  onRevealInTree: (path: string) => void;
}

type TabMenu = { x: number; y: number; path: string } | null;

export function EditorTabs({ tabs, activePath, onSelect, onClose, onCloseMany, onRevealInTree }: EditorTabsProps) {
  const [menu, setMenu] = useState<TabMenu>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  useOutsideClick(menuRef, menu !== null, () => setMenu(null));

  if (tabs.length === 0) return null;

  const menuIdx = menu ? tabs.findIndex((t) => t.path === menu.path) : -1;
  const menuTab = menuIdx >= 0 ? tabs[menuIdx] : null;
  const hasOthers = tabs.length > 1;
  const hasRight = menuIdx >= 0 && menuIdx < tabs.length - 1;

  const runMenu = (paths: string[]) => {
    setMenu(null);
    if (paths.length > 0) onCloseMany(paths);
  };

  const copyToClipboard = (text: string) => {
    setMenu(null);
    void (async () => {
      try {
        await navigator.clipboard.writeText(text);
        showHintToast(
          <>
            <code className="toast-code">{text}</code> 복사 완료
          </>,
        );
      } catch {
        showErrorToast("클립보드 복사에 실패했습니다.");
      }
    })();
  };

  const revealInFinder = (path: string) => {
    setMenu(null);
    void filesShellApi
      .revealInFinder(path)
      .catch((e) => showErrorToast(`Finder 에서 열지 못했습니다: ${e}`));
  };

  const revealInTree = (path: string) => {
    setMenu(null);
    onRevealInTree(path);
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
          <button type="button" onClick={() => copyToClipboard(menu.path)}>
            경로 복사
          </button>
          {menuTab && (
            <button type="button" onClick={() => copyToClipboard(menuTab.name)}>
              이름 복사
            </button>
          )}
          <button type="button" onClick={() => revealInFinder(menu.path)}>
            Finder에서 보기
          </button>
          <button type="button" onClick={() => revealInTree(menu.path)}>
            트리에서 보기
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
