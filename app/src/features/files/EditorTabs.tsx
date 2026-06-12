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
}

export function EditorTabs({ tabs, activePath, onSelect, onClose }: EditorTabsProps) {
  if (tabs.length === 0) return null;
  return (
    <div className="files-tabs" role="tablist">
      {tabs.map((t) => (
        <div
          key={t.path}
          role="tab"
          aria-selected={t.path === activePath}
          className={`files-tab${t.path === activePath ? " active" : ""}`}
          title={t.path}
          onClick={() => onSelect(t.path)}
        >
          <span className="files-tab-name">{t.name}</span>
          {t.dirty && <span className="files-tab-dirty" aria-label="unsaved" />}
          <button
            type="button"
            className="files-tab-close"
            aria-label={`close ${t.name}`}
            onClick={(e) => {
              e.stopPropagation();
              onClose(t.path);
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
