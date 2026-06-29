import { useCallback, useEffect, useRef, useState } from "react";
import { showConfirmToast } from "../../components/ui/ConfirmToast";
import { showErrorToast, showHintToast } from "../../components/ui/Toast";
import { ChevronIcon, FileIcon, FolderIcon, PlusIcon } from "../../components/ui/icons";
import { useOutsideClick } from "../../components/ui/useOutsideClick";
import { filesShellApi } from "./api";
import { fileOps, listDir } from "./fs";
import type { RevealRequest, TreeMutation, TreeNode } from "./types";

interface FileTreeProps {
  root: string;
  activePath: string | null;
  /** 탭 등 외부에서 "트리에서 보기" 요청 — 조상 폴더를 펼치고 스크롤·강조한다. */
  revealRequest: RevealRequest | null;
  onOpenFile: (node: TreeNode) => void;
  onMutate: (m: TreeMutation) => void;
}

type CtxMenu = { x: number; y: number; node: TreeNode } | null;
/** 인라인 입력 상태 — rename 은 node, create 는 부모 dirPath 기준. */
type Editing =
  | { kind: "rename"; node: TreeNode }
  | { kind: "new-file" | "new-dir"; dirPath: string }
  | null;

export function FileTree({ root, activePath, revealRequest, onOpenFile, onMutate }: FileTreeProps) {
  const [childrenByDir, setChildrenByDir] = useState<Map<string, TreeNode[]>>(new Map());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [ctxMenu, setCtxMenu] = useState<CtxMenu>(null);
  const [editing, setEditing] = useState<Editing>(null);
  /** "트리에서 보기" 로 강조 중인 경로 — 잠시 후 해제. */
  const [revealed, setRevealed] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
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

  // "트리에서 보기" 요청 — 대상의 조상 폴더를 모두 펼치고 로드한 뒤 강조.
  useEffect(() => {
    if (!revealRequest) return;
    const target = revealRequest.path;
    if (target !== root && !target.startsWith(`${root}/`)) return;
    void (async () => {
      const rel = target.slice(root.length + 1);
      const parts = rel ? rel.split("/") : [];
      let acc = root;
      const ancestors: string[] = [];
      for (let i = 0; i < parts.length - 1; i++) {
        acc = `${acc}/${parts[i]}`;
        ancestors.push(acc);
      }
      for (const dir of ancestors) await loadDir(dir);
      setExpanded((prev) => new Set([...prev, ...ancestors]));
      setRevealed(target);
    })();
  }, [revealRequest, root, loadDir]);

  // 대상 row 가 렌더되면(조상 펼침·로드 완료) 가운데로 스크롤하고 1.2초 뒤 강조 해제.
  useEffect(() => {
    if (!revealed) return;
    const el = bodyRef.current?.querySelector<HTMLElement>(
      `[data-path="${CSS.escape(revealed)}"]`,
    );
    if (!el) return;
    el.scrollIntoView({ block: "center" });
    const t = setTimeout(() => setRevealed(null), 1200);
    return () => clearTimeout(t);
  }, [revealed, childrenByDir, expanded]);

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

  const copyToClipboard = (text: string) => {
    setCtxMenu(null);
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
    setCtxMenu(null);
    void filesShellApi
      .revealInFinder(path)
      .catch((e) => showErrorToast(`Finder 에서 열지 못했습니다: ${e}`));
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
                node.path === revealed ? "revealed" : "",
                node.isDir ? "dir" : "file",
              ].filter(Boolean).join(" ")}
              data-path={node.path}
              style={{ paddingLeft: 8 + depth * 14 }}
              onClick={() => (node.isDir ? toggleDir(node) : onOpenFile(node))}
              onContextMenu={(e) => {
                e.preventDefault();
                setCtxMenu({ x: e.clientX, y: e.clientY, node });
              }}
            >
              <span className="files-tree-caret-slot">
                {node.isDir && (
                  <span className="files-tree-caret" aria-hidden>
                    <ChevronIcon rotation={expanded.has(node.path) ? 90 : 0} size={15} />
                  </span>
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
        <div className="files-tree-actions" aria-label="파일 트리 작업">
          <button type="button" className="files-icon-btn" aria-label="새 파일" onClick={() => startCreate("new-file", root)}>
            <PlusIcon size={13} />
            <span>파일</span>
          </button>
          <button type="button" className="files-icon-btn" aria-label="새 폴더" onClick={() => startCreate("new-dir", root)}>
            <PlusIcon size={13} />
            <span>폴더</span>
          </button>
        </div>
      </div>
      <div className="files-tree-body" ref={bodyRef}>{renderNodes(root, 0)}</div>
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
          <button type="button" onClick={() => copyToClipboard(ctxMenu.node.path)}>경로 복사</button>
          <button type="button" onClick={() => copyToClipboard(ctxMenu.node.name)}>이름 복사</button>
          <button type="button" onClick={() => revealInFinder(ctxMenu.node.path)}>Finder에서 보기</button>
          <button type="button" className="danger" onClick={() => requestDelete(ctxMenu.node)}>삭제</button>
        </div>
      )}
    </div>
  );
}
