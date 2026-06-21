import { useCallback, useEffect, useRef, useState } from "react";
import { showConfirmToast } from "../../components/ui/ConfirmToast";
import { showErrorToast } from "../../components/ui/Toast";
import { FileIcon, FolderIcon } from "../../components/ui/icons";
import { useOutsideClick } from "../../components/ui/useOutsideClick";
import { fileOps, listDir } from "./fs";
import type { TreeMutation, TreeNode } from "./types";

interface FileTreeProps {
  root: string;
  activePath: string | null;
  onOpenFile: (node: TreeNode) => void;
  onMutate: (m: TreeMutation) => void;
}

type CtxMenu = { x: number; y: number; node: TreeNode } | null;
/** 인라인 입력 상태 — rename 은 node, create 는 부모 dirPath 기준. */
type Editing =
  | { kind: "rename"; node: TreeNode }
  | { kind: "new-file" | "new-dir"; dirPath: string }
  | null;

export function FileTree({ root, activePath, onOpenFile, onMutate }: FileTreeProps) {
  const [childrenByDir, setChildrenByDir] = useState<Map<string, TreeNode[]>>(new Map());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [ctxMenu, setCtxMenu] = useState<CtxMenu>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  // Enter → blur 이중 commit 방지: commitEditing 진행 중이면 두 번째 호출을 무시
  const committingRef = useRef(false);
  useOutsideClick(menuRef, ctxMenu !== null, () => setCtxMenu(null));

  const loadDir = useCallback(async (dirPath: string) => {
    try {
      const nodes = await listDir(dirPath);
      setChildrenByDir((prev) => new Map(prev).set(dirPath, nodes));
    } catch (e) {
      showErrorToast(`폴더를 읽지 못했습니다: ${e}`);
    }
  }, []);

  // 루트가 바뀌면 캐시·펼침 초기화 후 루트 한 단계 로드
  useEffect(() => {
    setChildrenByDir(new Map());
    setExpanded(new Set());
    setEditing(null);
    setCtxMenu(null);
    void loadDir(root);
  }, [root, loadDir]);

  const toggleDir = (node: TreeNode) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(node.path)) {
        next.delete(node.path);
      } else {
        next.add(node.path);
        if (!childrenByDir.has(node.path)) void loadDir(node.path);
      }
      return next;
    });
  };

  const parentOf = (path: string) => path.slice(0, path.lastIndexOf("/")) || root;

  const commitEditing = async (value: string, snapshot: Editing) => {
    // Enter → blur 이중 commit 방지
    if (committingRef.current) return;
    committingRef.current = true;

    const name = value.trim();
    setEditing(null);

    try {
      if (!snapshot || !name) return;
      if (snapshot.kind === "rename") {
        const dir = parentOf(snapshot.node.path);
        const newPath = `${dir}/${name}`;
        if (newPath !== snapshot.node.path) {
          await fileOps.rename(snapshot.node.path, newPath);
          onMutate({ type: "rename", path: snapshot.node.path, newPath, isDir: snapshot.node.isDir });
          await loadDir(dir);
        }
      } else {
        const newPath = `${snapshot.dirPath}/${name}`;
        if (snapshot.kind === "new-file") await fileOps.createFile(newPath);
        else await fileOps.createDir(newPath);
        onMutate({ type: "create" });
        await loadDir(snapshot.dirPath);
      }
    } catch (e) {
      showErrorToast(`작업에 실패했습니다: ${e}`);
    } finally {
      committingRef.current = false;
    }
  };

  const requestDelete = (node: TreeNode) => {
    setCtxMenu(null);
    showConfirmToast({
      message: `"${node.name}" 을(를) 삭제할까요? 디스크에서 실제로 삭제됩니다.`,
      confirmLabel: "삭제",
      cancelLabel: "취소",
      onConfirm: () => {
        void (async () => {
          try {
            await fileOps.remove(node.path);
            onMutate({ type: "delete", path: node.path, isDir: node.isDir });
            await loadDir(parentOf(node.path));
          } catch (e) {
            showErrorToast(`삭제에 실패했습니다: ${e}`);
          }
        })();
      },
    });
  };

  const startCreate = (kind: "new-file" | "new-dir", dirPath: string) => {
    committingRef.current = false;
    setCtxMenu(null);
    setExpanded((prev) => new Set(prev).add(dirPath));
    if (!childrenByDir.has(dirPath)) void loadDir(dirPath);
    setEditing({ kind, dirPath });
  };

  const renderInlineInput = (defaultValue: string, snapshot: Editing) => (
    <input
      className="files-tree-inline-input"
      autoFocus
      defaultValue={defaultValue}
      onBlur={(e) => void commitEditing(e.currentTarget.value, snapshot)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          // blur 가 이어서 발생하므로 committingRef 로 이중 실행 방지
          void commitEditing(e.currentTarget.value, snapshot);
        }
        if (e.key === "Escape") {
          committingRef.current = true;
          setEditing(null);
        }
      }}
    />
  );

  const renderNodes = (dirPath: string, depth: number) => {
    const nodes = childrenByDir.get(dirPath);
    if (!nodes) return null;
    return (
      <>
        {editing && editing.kind !== "rename" && editing.dirPath === dirPath && (
          <div className="files-tree-row" style={{ paddingLeft: 8 + depth * 14 }}>
            {renderInlineInput("", editing)}
          </div>
        )}
        {nodes.map((node) => (
          <div key={node.path}>
            <div
              className={[
                "files-tree-row",
                node.path === activePath ? "active" : "",
                node.isDir ? "dir" : "file",
              ].filter(Boolean).join(" ")}
              style={{ paddingLeft: 8 + depth * 14 }}
              onClick={() => (node.isDir ? toggleDir(node) : onOpenFile(node))}
              onContextMenu={(e) => {
                e.preventDefault();
                setCtxMenu({ x: e.clientX, y: e.clientY, node });
              }}
            >
              <span className="files-tree-caret-slot">
                {node.isDir && (
                  <span className={`files-tree-caret${expanded.has(node.path) ? " open" : ""}`}>▸</span>
                )}
              </span>
              <span className={`files-tree-ficon${node.isDir ? " dir" : ""}`} aria-hidden>
                {node.isDir ? <FolderIcon /> : <FileIcon />}
              </span>
              {editing && editing.kind === "rename" && editing.node.path === node.path
                ? renderInlineInput(node.name, editing)
                : <span className="files-tree-name">{node.name}</span>}
            </div>
            {node.isDir && expanded.has(node.path) && renderNodes(node.path, depth + 1)}
          </div>
        ))}
      </>
    );
  };

  return (
    <div className="files-tree">
      <div className="files-tree-header">
        <button type="button" className="btn btn-ghost btn--sm" onClick={() => startCreate("new-file", root)}>
          + 파일
        </button>
        <button type="button" className="btn btn-ghost btn--sm" onClick={() => startCreate("new-dir", root)}>
          + 폴더
        </button>
      </div>
      <div className="files-tree-body">{renderNodes(root, 0)}</div>
      {ctxMenu && (
        <div ref={menuRef} className="files-ctxmenu" style={{ top: ctxMenu.y, left: ctxMenu.x }}>
          {ctxMenu.node.isDir && (
            <>
              <button type="button" onClick={() => startCreate("new-file", ctxMenu.node.path)}>새 파일</button>
              <button type="button" onClick={() => startCreate("new-dir", ctxMenu.node.path)}>새 폴더</button>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              committingRef.current = false;
              setEditing({ kind: "rename", node: ctxMenu.node });
              setCtxMenu(null);
            }}
          >
            이름 변경
          </button>
          <button type="button" className="danger" onClick={() => requestDelete(ctxMenu.node)}>삭제</button>
        </div>
      )}
    </div>
  );
}
