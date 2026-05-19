import { useMemo, useState } from "react";
import { ChevronIcon } from "../../components/ui/icons";
import { FolderIcon } from "./icons";
import type { MemoFolder, MemoListScope } from "./types";

const FOLDER_MIME = "application/x-memo-folder-id";
const MEMO_MIME = "application/x-memo-id";

interface FolderTreeProps {
  folders: MemoFolder[];
  selectedScope: MemoListScope;
  selectedFolderId: number | null;
  onSelect: (scope: MemoListScope, folderId: number | null) => void;
  onAddFolder: (parentId: number | null, name: string) => void;
  onRenameFolder: (id: number, name: string) => void;
  onDeleteFolder: (id: number, name: string) => void;
  trashCount: number;
  onCreateMemo: () => void;
  /** 편집기 열림 상태 — 사이드바의 "+ 새 메모" 를 잠가 편집 컨텍스트가 갑자기 바뀌는 것을 막는다. */
  createMemoDisabled?: boolean;
  draggedMemo: { id: number; folderId: number | null } | null;
  onDropMemoToFolder: (memoId: number, folderId: number) => void;
  /** 같은 부모 아래 형제 폴더들의 새 순서. 호출자(MemoPage)가 memoFolderApi.reorder 로 전달. */
  onReorderFolders: (parentId: number | null, orderedIds: number[]) => void;
  /** 폴더의 부모 변경. 새 부모의 마지막 자식이 된다. parentId=null 이면 루트. */
  onMoveFolderTo: (id: number, parentId: number | null) => void;
}

interface TreeNode extends MemoFolder {
  children: TreeNode[];
}

function buildTree(folders: MemoFolder[]): TreeNode[] {
  const byId = new Map<number, TreeNode>();
  folders.forEach((f) => byId.set(f.id, { ...f, children: [] }));
  const roots: TreeNode[] = [];
  byId.forEach((node) => {
    if (node.parent_id === null) {
      roots.push(node);
    } else {
      const parent = byId.get(node.parent_id);
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
  });
  const sortRec = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

/** `rootId` 자신 + 모든 자손 폴더 id 집합. drop 대상이 되면 사이클 → 미리 차단. */
function collectSelfAndDescendants(folders: MemoFolder[], rootId: number): Set<number> {
  const out = new Set<number>([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of folders) {
      if (f.parent_id !== null && out.has(f.parent_id) && !out.has(f.id)) {
        out.add(f.id);
        grew = true;
      }
    }
  }
  return out;
}

type DraggedFolder = { id: number; parentId: number | null };

export default function FolderTree(props: FolderTreeProps) {
  const tree = useMemo(() => buildTree(props.folders), [props.folders]);
  // 인라인 추가 중인 parentId. null = 루트에 추가 중. undefined = 추가 중 아님.
  const [addingUnder, setAddingUnder] = useState<number | null | undefined>(undefined);
  const isAddingRoot = addingUnder === null;
  const [draggedFolder, setDraggedFolder] = useState<DraggedFolder | null>(null);
  const [tailHover, setTailHover] = useState(false);
  const forbiddenIds = useMemo(
    () =>
      draggedFolder
        ? collectSelfAndDescendants(props.folders, draggedFolder.id)
        : new Set<number>(),
    [draggedFolder, props.folders],
  );

  // 같은 부모 안에서 dragged 를 target 의 위/아래로 이동시킨 새 형제 ID 배열.
  const computeReordered = (
    parentId: number | null,
    draggedId: number,
    targetId: number,
    position: "above" | "below",
  ): number[] => {
    const siblings = props.folders
      .filter((f) => f.parent_id === parentId)
      .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
      .map((f) => f.id);
    const without = siblings.filter((id) => id !== draggedId);
    const targetIdx = without.indexOf(targetId);
    if (targetIdx < 0) return siblings; // 안전장치 — 변화 없음.
    const insertAt = position === "above" ? targetIdx : targetIdx + 1;
    return [...without.slice(0, insertAt), draggedId, ...without.slice(insertAt)];
  };

  const handleReorderHere = (
    target: { id: number; parent_id: number | null },
    position: "above" | "below",
  ) => {
    if (!draggedFolder) return;
    if (draggedFolder.parentId !== target.parent_id) return;
    if (draggedFolder.id === target.id) return;
    const next = computeReordered(
      target.parent_id,
      draggedFolder.id,
      target.id,
      position,
    );
    const current = props.folders
      .filter((f) => f.parent_id === target.parent_id)
      .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
      .map((f) => f.id);
    // 변화 없으면 no-op (idempotent).
    if (current.length === next.length && current.every((id, i) => id === next[i])) return;
    props.onReorderFolders(target.parent_id, next);
  };

  const handleAppendToFolder = (newParentId: number) => {
    if (!draggedFolder) return;
    if (forbiddenIds.has(newParentId)) return;
    if (draggedFolder.parentId === newParentId) return; // 같은 부모 → reorder 영역이 처리.
    props.onMoveFolderTo(draggedFolder.id, newParentId);
  };

  const handleDropOnTail = () => {
    if (!draggedFolder) return;
    if (draggedFolder.parentId === null) {
      // 이미 루트 → 맨 뒤로 reorder.
      const roots = props.folders
        .filter((f) => f.parent_id === null)
        .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
        .map((f) => f.id);
      const without = roots.filter((id) => id !== draggedFolder.id);
      const next = [...without, draggedFolder.id];
      if (roots.length === next.length && roots.every((id, i) => id === next[i])) return;
      props.onReorderFolders(null, next);
    } else {
      // 다른 부모에서 → 루트의 마지막 자식으로 (move 가 자동 MAX+1 부여).
      props.onMoveFolderTo(draggedFolder.id, null);
    }
  };

  return (
    <aside className="memo-sidebar">
      <div className="memo-sidebar-cta">
        <button
          type="button"
          className="memo-sidebar-new-btn"
          onClick={props.onCreateMemo}
          disabled={props.createMemoDisabled}
        >
          + 새 메모
        </button>
      </div>
      <div className="memo-sidebar-section">
        <button
          type="button"
          className={`memo-sidebar-row ${
            props.selectedScope === "active" ? "selected" : ""
          }`}
          onClick={() => props.onSelect("active", null)}
        >
          <span className="memo-sidebar-row-label">모든 메모</span>
        </button>
        <button
          type="button"
          className={`memo-sidebar-row ${
            props.selectedScope === "trash" ? "selected" : ""
          }`}
          onClick={() => props.onSelect("trash", null)}
        >
          <span className="memo-sidebar-row-label">최근 삭제</span>
          {props.trashCount > 0 && (
            <span className="memo-sidebar-badge">{props.trashCount}</span>
          )}
        </button>
      </div>

      <div className="memo-sidebar-section memo-sidebar-section--folders">
        <div className="memo-sidebar-section-header">
          <span>폴더</span>
          <button
            type="button"
            className="memo-sidebar-icon-btn"
            onClick={() => setAddingUnder(null)}
            title="루트 폴더 추가"
            aria-label="루트 폴더 추가"
          >
            +
          </button>
        </div>
        {isAddingRoot && (
          <AddFolderInput
            depth={0}
            onCommit={(name) => {
              props.onAddFolder(null, name);
              setAddingUnder(undefined);
            }}
            onCancel={() => setAddingUnder(undefined)}
          />
        )}
        {tree.map((node) => (
          <FolderNode
            key={node.id}
            node={node}
            depth={0}
            selectedFolderId={
              props.selectedScope === "folder" ? props.selectedFolderId : null
            }
            onSelect={(id) => props.onSelect("folder", id)}
            addingUnder={addingUnder}
            onStartAdd={(parentId) => setAddingUnder(parentId)}
            onCommitAdd={(parentId, name) => {
              props.onAddFolder(parentId, name);
              setAddingUnder(undefined);
            }}
            onCancelAdd={() => setAddingUnder(undefined)}
            onRename={props.onRenameFolder}
            onDelete={props.onDeleteFolder}
            draggedMemo={props.draggedMemo}
            onDropMemoToFolder={props.onDropMemoToFolder}
            draggedFolder={draggedFolder}
            forbiddenIds={forbiddenIds}
            onFolderDragStart={(payload) => setDraggedFolder(payload)}
            onFolderDragEnd={() => setDraggedFolder(null)}
            onReorderHere={handleReorderHere}
            onAppendToFolder={handleAppendToFolder}
          />
        ))}
        <div
          className={`memo-folder-tree-tail ${
            tailHover ? "memo-folder-tree-tail--hover" : ""
          }`}
          onDragOver={(e) => {
            if (!draggedFolder) return;
            if (!Array.from(e.dataTransfer.types).includes(FOLDER_MIME)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (!tailHover) setTailHover(true);
          }}
          onDragLeave={() => {
            if (tailHover) setTailHover(false);
          }}
          onDrop={(e) => {
            if (!draggedFolder) return;
            if (!Array.from(e.dataTransfer.types).includes(FOLDER_MIME)) return;
            e.preventDefault();
            setTailHover(false);
            handleDropOnTail();
          }}
        />
      </div>
    </aside>
  );
}

interface FolderNodeProps {
  node: TreeNode;
  depth: number;
  selectedFolderId: number | null;
  addingUnder: number | null | undefined;
  onSelect: (id: number) => void;
  onStartAdd: (parentId: number) => void;
  onCommitAdd: (parentId: number, name: string) => void;
  onCancelAdd: () => void;
  onRename: (id: number, name: string) => void;
  onDelete: (id: number, name: string) => void;
  draggedMemo: { id: number; folderId: number | null } | null;
  onDropMemoToFolder: (memoId: number, folderId: number) => void;
  draggedFolder: DraggedFolder | null;
  forbiddenIds: Set<number>;
  onFolderDragStart: (payload: DraggedFolder) => void;
  onFolderDragEnd: () => void;
  onReorderHere: (
    target: { id: number; parent_id: number | null },
    position: "above" | "below",
  ) => void;
  onAppendToFolder: (targetId: number) => void;
}

type DropZone = "above" | "into" | "below" | null;

function FolderNode({
  node,
  depth,
  selectedFolderId,
  addingUnder,
  onSelect,
  onStartAdd,
  onCommitAdd,
  onCancelAdd,
  onRename,
  onDelete,
  draggedMemo,
  onDropMemoToFolder,
  draggedFolder,
  forbiddenIds,
  onFolderDragStart,
  onFolderDragEnd,
  onReorderHere,
  onAppendToFolder,
}: FolderNodeProps) {
  const [open, setOpen] = useState(true);
  const [memoDropHover, setMemoDropHover] = useState(false);
  const [folderZone, setFolderZone] = useState<DropZone>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(node.name);
  const isSelected = selectedFolderId === node.id;
  const showAddChild = addingUnder === node.id;

  const canDropMemo = draggedMemo !== null && draggedMemo.folderId !== node.id;
  const sameFolderParent =
    draggedFolder !== null && draggedFolder.parentId === node.parent_id;
  const canFolderDrop =
    draggedFolder !== null && !forbiddenIds.has(node.id);

  const commitRename = () => {
    const next = draft.trim();
    setEditing(false);
    if (next !== "" && next !== node.name) {
      onRename(node.id, next);
    } else {
      setDraft(node.name);
    }
  };

  const rowClass = [
    "memo-sidebar-row",
    "memo-folder-row",
    isSelected ? "selected" : "",
    memoDropHover ? "memo-folder-row--drop-target" : "",
    folderZone === "into" ? "memo-folder-row--drop-target" : "",
    folderZone === "above" ? "memo-folder-row--insert-above" : "",
    folderZone === "below" ? "memo-folder-row--insert-below" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <div
        className={rowClass}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        draggable={!editing}
        onDragStart={(e) => {
          if (editing) return;
          e.dataTransfer.setData(FOLDER_MIME, String(node.id));
          e.dataTransfer.effectAllowed = "move";
          onFolderDragStart({ id: node.id, parentId: node.parent_id });
        }}
        onDragEnd={() => {
          setFolderZone(null);
          onFolderDragEnd();
        }}
        onClick={() => {
          if (editing) return;
          onSelect(node.id);
        }}
        onDragOver={(e) => {
          const types = Array.from(e.dataTransfer.types);
          // 폴더 DnD 가 우선. 폴더가 드래그 중이 아니면 메모 DnD 분기.
          if (types.includes(FOLDER_MIME)) {
            if (!canFolderDrop) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            const rect = e.currentTarget.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const h = rect.height;
            let zone: DropZone;
            if (sameFolderParent && y < h * 0.25) zone = "above";
            else if (sameFolderParent && y > h * 0.75) zone = "below";
            else zone = "into";
            // 자기 자신 위에서의 reorder 는 의미 없음 → into 도 자기 자손 차단됨.
            if (zone === "into" && forbiddenIds.has(node.id)) return;
            if (zone !== folderZone) setFolderZone(zone);
            return;
          }
          if (types.includes(MEMO_MIME)) {
            if (!canDropMemo) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (!memoDropHover) setMemoDropHover(true);
          }
        }}
        onDragLeave={() => {
          if (folderZone !== null) setFolderZone(null);
          if (memoDropHover) setMemoDropHover(false);
        }}
        onDrop={(e) => {
          const types = Array.from(e.dataTransfer.types);
          if (types.includes(FOLDER_MIME)) {
            if (!canFolderDrop) return;
            e.preventDefault();
            const raw = e.dataTransfer.getData(FOLDER_MIME);
            const zone = folderZone;
            setFolderZone(null);
            if (raw === "") return;
            if (zone === "above" || zone === "below") {
              onReorderHere({ id: node.id, parent_id: node.parent_id }, zone);
            } else if (zone === "into") {
              onAppendToFolder(node.id);
            }
            return;
          }
          if (types.includes(MEMO_MIME)) {
            if (!canDropMemo) return;
            e.preventDefault();
            const raw = e.dataTransfer.getData(MEMO_MIME);
            setMemoDropHover(false);
            if (raw === "") return;
            const memoId = Number(raw);
            if (!Number.isFinite(memoId)) return;
            onDropMemoToFolder(memoId, node.id);
          }
        }}
      >
        {node.children.length > 0 ? (
          <button
            type="button"
            className="memo-folder-chevron"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            aria-label={open ? "접기" : "펼치기"}
          >
            <ChevronIcon rotation={open ? 90 : 0} />
          </button>
        ) : (
          <span className="memo-folder-chevron-placeholder" />
        )}
        <span className="memo-folder-icon" aria-hidden>
          <FolderIcon filled={isSelected} />
        </span>
        {editing ? (
          <input
            className="memo-folder-rename-input"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setDraft(node.name);
                setEditing(false);
              }
            }}
          />
        ) : (
          <span
            className="memo-folder-name-btn"
            onDoubleClick={() => setEditing(true)}
          >
            {node.name}
          </span>
        )}
        <span className="memo-folder-actions">
          <button
            type="button"
            className="memo-sidebar-icon-btn"
            onClick={(e) => {
              e.stopPropagation();
              onStartAdd(node.id);
            }}
            title="하위 폴더 추가"
            aria-label="하위 폴더 추가"
          >
            +
          </button>
          <button
            type="button"
            className="memo-sidebar-icon-btn memo-sidebar-icon-btn--danger"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(node.id, node.name);
            }}
            title="삭제"
            aria-label="폴더 삭제"
          >
            ×
          </button>
        </span>
      </div>
      {showAddChild && (
        <AddFolderInput
          depth={depth + 1}
          onCommit={(name) => onCommitAdd(node.id, name)}
          onCancel={onCancelAdd}
        />
      )}
      {open &&
        node.children.map((child) => (
          <FolderNode
            key={child.id}
            node={child}
            depth={depth + 1}
            selectedFolderId={selectedFolderId}
            addingUnder={addingUnder}
            onSelect={onSelect}
            onStartAdd={onStartAdd}
            onCommitAdd={onCommitAdd}
            onCancelAdd={onCancelAdd}
            onRename={onRename}
            onDelete={onDelete}
            draggedMemo={draggedMemo}
            onDropMemoToFolder={onDropMemoToFolder}
            draggedFolder={draggedFolder}
            forbiddenIds={forbiddenIds}
            onFolderDragStart={onFolderDragStart}
            onFolderDragEnd={onFolderDragEnd}
            onReorderHere={onReorderHere}
            onAppendToFolder={onAppendToFolder}
          />
        ))}
    </>
  );
}

interface AddFolderInputProps {
  depth: number;
  onCommit: (name: string) => void;
  onCancel: () => void;
}

function AddFolderInput({ depth, onCommit, onCancel }: AddFolderInputProps) {
  const [value, setValue] = useState("");
  // blur 와 Enter 가 동시에 호출되는 걸 막기 위한 가드.
  const [committed, setCommitted] = useState(false);

  const commit = () => {
    if (committed) return;
    setCommitted(true);
    const trimmed = value.trim();
    if (trimmed === "") onCancel();
    else onCommit(trimmed);
  };

  return (
    <div
      className="memo-sidebar-row memo-folder-add-row"
      style={{ paddingLeft: `${8 + depth * 12}px` }}
    >
      <span className="memo-folder-chevron-placeholder" />
      <span className="memo-folder-icon" aria-hidden>
        <FolderIcon />
      </span>
      <input
        className="memo-folder-rename-input"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="새 폴더"
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            setCommitted(true);
            onCancel();
          }
        }}
      />
    </div>
  );
}
