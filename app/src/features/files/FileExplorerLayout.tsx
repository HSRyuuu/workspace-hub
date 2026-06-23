import { EditorTabs } from "./EditorTabs";
import { FileEditor } from "./FileEditor";
import { FileTree } from "./FileTree";
import { FolderBar } from "./FolderBar";
import { MarkdownPreview } from "./MarkdownPreview";
import type { ExplorerFolder, OpenTab, TreeMutation, TreeNode } from "./types";

interface FileExplorerLayoutProps {
  readonly current: ExplorerFolder | null;
  readonly folders: readonly ExplorerFolder[];
  readonly tabs: readonly OpenTab[];
  readonly activeTab: OpenTab | null;
  readonly activePath: string | null;
  readonly dirtyPaths: ReadonlySet<string>;
  readonly mode: "edit" | "preview";
  readonly showPreviewToggle: boolean;
  readonly contentForActiveTab: string;
  readonly onPickNewFolder: () => void;
  readonly onOpenFolder: (path: string) => void;
  readonly onToggleFavorite: (folder: ExplorerFolder) => void;
  readonly onOpenFile: (node: TreeNode) => void;
  readonly onTreeMutation: (mutation: TreeMutation) => void;
  readonly onSelectTab: (path: string) => void;
  readonly onCloseTab: (path: string) => void;
  readonly onCloseTabs: (paths: string[]) => void;
  readonly onModeChange: (mode: "edit" | "preview") => void;
  readonly onContentChange: (content: string) => void;
}

export function FileExplorerLayout({
  current,
  folders,
  tabs,
  activeTab,
  activePath,
  dirtyPaths,
  mode,
  showPreviewToggle,
  contentForActiveTab,
  onPickNewFolder,
  onOpenFolder,
  onToggleFavorite,
  onOpenFile,
  onTreeMutation,
  onSelectTab,
  onCloseTab,
  onCloseTabs,
  onModeChange,
  onContentChange,
}: FileExplorerLayoutProps) {
  return (
    <div className="files-layout">
      <div className="files-side">
        <FolderBar
          current={current}
          folders={folders}
          onPickNewFolder={onPickNewFolder}
          onSelectFolder={(folder) => onOpenFolder(folder.path)}
          onToggleFavorite={onToggleFavorite}
        />
        {current && (
          <FileTree
            root={current.path}
            activePath={activePath}
            onOpenFile={onOpenFile}
            onMutate={onTreeMutation}
          />
        )}
        {!current && (
          <div className="files-side-empty">
            <strong>열린 폴더가 없습니다</strong>
            <span>상단의 폴더 열기로 작업할 디렉터리를 선택하세요.</span>
          </div>
        )}
      </div>
      <div className="files-main">
        <div className="files-main-top">
          <EditorTabs
            tabs={tabs.map((tab) => ({ path: tab.path, name: tab.name, dirty: dirtyPaths.has(tab.path) }))}
            activePath={activePath}
            onSelect={onSelectTab}
            onClose={onCloseTab}
            onCloseMany={onCloseTabs}
          />
          {showPreviewToggle && (
            <div className="files-mode-toggle" role="tablist">
              <button type="button" className={mode === "edit" ? "active" : ""} onClick={() => onModeChange("edit")}>
                Edit
              </button>
              <button type="button" className={mode === "preview" ? "active" : ""} onClick={() => onModeChange("preview")}>
                Preview
              </button>
            </div>
          )}
        </div>
        {!activeTab && (
          <EmptyState
            title={current ? "편집할 파일을 선택하세요" : "폴더를 먼저 열어주세요"}
            body={current ? "왼쪽 탐색 트리에서 텍스트 파일을 선택하면 이 영역에 에디터가 열립니다." : "최근 폴더가 없으면 폴더 열기로 시작할 수 있습니다."}
            actionLabel="폴더 열기"
            onAction={onPickNewFolder}
          />
        )}
        {activeTab?.binary && (
          <EmptyState
            title="바이너리 파일은 열 수 없습니다"
            body="텍스트로 디코딩할 수 없는 파일입니다. 이미지, 압축 파일, 실행 파일은 파일탐색기에서 편집하지 않습니다."
          />
        )}
        {activeTab && !activeTab.binary && mode === "edit" && (
          <FileEditor
            path={activeTab.path}
            initialContent={contentForActiveTab}
            onChange={onContentChange}
          />
        )}
        {activeTab && !activeTab.binary && mode === "preview" && (
          <MarkdownPreview path={activeTab.path} content={contentForActiveTab} />
        )}
      </div>
    </div>
  );
}

interface EmptyStateProps {
  readonly title: string;
  readonly body: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
}

function EmptyState({ title, body, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="files-empty">
      <div className="files-empty-panel">
        <span className="files-empty-mark" aria-hidden />
        <strong>{title}</strong>
        <p>{body}</p>
        {actionLabel && onAction && (
          <button type="button" className="btn btn-primary btn--sm" onClick={onAction}>
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
